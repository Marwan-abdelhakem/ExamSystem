import dotenv from "dotenv";
dotenv.config();

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChatGroq } from "@langchain/groq";
import { StateGraph, END, START } from "@langchain/langgraph";
import { ExamSchema } from "./exam.validation.js";
import { MongoClient, ObjectId } from "mongodb";
import { z } from "zod";

const ReviewSchema = z.object({
  verdict: z.enum(["PASSED", "FAILED"]),
  reason: z.string(),
});

function toObjectId(id) {
  if (id instanceof ObjectId) return id;
  if (typeof id === "string" && ObjectId.isValid(id)) return new ObjectId(id);
  throw new Error(`Invalid exam_id: ${id}`);
}

/* =========================
   LLM & EMBEDDINGS
========================= */

// export const llm = new ChatOpenAI({
//   model: "gpt-4o-mini",
//   temperature: 0.1,
//   apiKey: process.env.API_KEY,
// });

// export const embeddings = new OpenAIEmbeddings({
//   model: "text-embedding-3-small",
//   apiKey: process.env.API_KEY,
// });

export const llm = new ChatGroq({
  model: "llama-3.3-70b-versatile",
  temperature: 0.2,
  apiKey: process.env.GROQ_API_KEY,
});

export const embeddings = new OpenAIEmbeddings({
  modelName: "@cf/baai/bge-large-en-v1.5", 
  apiKey: process.env.CLOUDFLARE_API_TOKEN,
  configuration: {
    baseURL: "https://cloudflare.com", 
    defaultHeaders: {
      "HTTP-Referer": process.env.BACKEND_URL || "http://localhost:3000",
      "X-Title": "Aigentic Exam Generator",
    },
  },
});



/* =========================
   COGNITIVE MATRIX
========================= */

const cognitiveMatrix = {
  Memorization_Easy: "Direct retrieval from document.",
  Memorization_Normal: "Extract detailed factual information.",
  Memorization_Hard: "Retrieve highly specific details.",
  Creativity_Easy: "Basic understanding and paraphrasing.",
  Creativity_Normal: "Explain causes and interpretations.",
  Creativity_Hard: "Complex comparison and synthesis.",
  Thinking_Easy: "Direct application of concept.",
  Thinking_Normal: "Logical deduction from multiple points.",
  Thinking_Hard: "Critical evaluation and reasoning.",
};

/* =========================
   LANGUAGE RULES
========================= */

const LANGUAGE_RULES = `
LANGUAGE PRESERVATION RULES:
1. Detect the original language of the provided document context.
2. ALL generated content MUST use the same language as the source document.
3. Never translate technical terms, framework names, library names, APIs, product names, function names, class names, variables, or foreign-language terms.
4. Preserve terminology exactly as it appears in the document.
5. Questions, options, and explanations must follow the same writing style and language used in the source document.
6. If the document mixes multiple languages, preserve the same mixture naturally.

IMPORTANT EXCEPTION:
For TF questions, correctAnswer MUST always be exactly "True" or "False" as a data value.
Do NOT translate correctAnswer to Arabic or any other language.
The displayed question text and ai_explanation must still match the document language.

CRITICAL RULE:
The output language MUST match the document language exactly, except TF correctAnswer which must remain "True" or "False".
`;

/* =========================
   HELPERS
========================= */

export function generateExamRulesDynamically(
  total,
  mcq,
  clientDifficultyRules,
) {
  const flatRules = [];
  clientDifficultyRules.forEach((rule) => {
    for (let i = 0; i < rule.count; i++) {
      flatRules.push({ difficulty: rule.difficulty, measures: rule.measures });
    }
  });
  flatRules.forEach((rule, index) => {
    rule.type = index < mcq ? "MCQ" : "TF";
  });
  return flatRules;
}

export async function splitTextIntoChunks(text) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  return await splitter.splitText(text);
}

/* =========================
   VECTOR SEARCH HELPERS
========================= */

export async function storePdfChunks(pdfText, exam_id) {
  const client = new MongoClient(process.env.MONGO_URL);
  const id = toObjectId(exam_id);

  try {
    const collection = client.db("test").collection("pdf_chunks");

    await collection.deleteMany({ exam_id: id });

    const chunks = await splitTextIntoChunks(pdfText);
    const allEmbeddings = await embeddings.embedDocuments(chunks);

    const docs = chunks.map((chunk, i) => ({
      exam_id: id,
      chunk_text: chunk,
      embedding: allEmbeddings[i],
    }));

    await collection.insertMany(docs);

    console.log(`✅ Stored ${docs.length} chunks for exam_id: ${id}`);
  } finally {
    await client.close();
  }
}

export async function retrieveRelevantChunks(query, exam_id, topK = 10) {
  const client = new MongoClient(process.env.MONGO_URL);
  const id = toObjectId(exam_id);

  try {
    const collection = client.db("test").collection("pdf_chunks");

    const queryEmbedding = await embeddings.embedQuery(query);

    const results = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: 150,
            limit: topK,
            filter: { exam_id: id },
          },
        },
        { $project: { chunk_text: 1, _id: 0 } },
      ])
      .toArray();

    return results.map((r) => r.chunk_text).join("\n\n");
  } finally {
    await client.close();
  }
}

/* =========================
   AGENTS
========================= */

const graphState = {
  channels: {
    exam_id: { value: (x, y) => y ?? x, default: () => null },
    pdfContext: { value: (x, y) => y ?? x, default: () => "" },
    requestedRules: { value: (x, y) => y ?? x, default: () => [] },
    draftedQuestions: { value: (x, y) => y ?? x, default: () => "" },
    finalExam: { value: (x, y) => y ?? x, default: () => null },
    reviewVerdict: { value: (x, y) => y ?? x, default: () => null },
    reviewFeedback: { value: (x, y) => y ?? x, default: () => null },
    retryCount: { value: (x, y) => y ?? x, default: () => 0 },
  },
};

async function generatorAgent(state) {
  console.log("\n🤖 Agent 1: Generating Questions...");

  let rulesPrompt = "";
  state.requestedRules.forEach((rule, index) => {
    const matrixKey = `${rule.measures}_${rule.difficulty}`;
    rulesPrompt += `\n- Question ${index + 1}\nType: ${rule.type}\nDifficulty: ${rule.difficulty}\nMeasures: ${rule.measures}\nGoal: ${cognitiveMatrix[matrixKey]}\n`;
  });

  const context = state.exam_id
    ? await retrieveRelevantChunks(rulesPrompt, state.exam_id, 10)
    : state.pdfContext;

  let prompt = `You are an expert professor.\n${LANGUAGE_RULES}\nUse this context:\n${context}\nGenerate exactly ${state.requestedRules.length} questions.\nRules:\n${rulesPrompt}\nIMPORTANT: Cover DIFFERENT parts. Do NOT generate answers yet.`;

  if (state.reviewVerdict === "FAILED") {
    prompt += `\nPrevious generation failed:\n${state.reviewFeedback}\n`;
  }

  const response = await llm.invoke(prompt);
  return {
    draftedQuestions: response.content.toString(),
    reviewVerdict: null,
    retryCount:
      state.reviewVerdict === "FAILED"
        ? state.retryCount + 1
        : state.retryCount,
  };
}

async function solverAgent(state) {
  console.log("🤖 Agent 2: Solving Questions...");
  const structuredLlm = llm.withStructuredOutput(ExamSchema);
  const context = state.exam_id
    ? await retrieveRelevantChunks(state.draftedQuestions, state.exam_id, 10)
    : state.pdfContext;

  let typeRulesPrompt = "";
  state.requestedRules.forEach((rule, index) => {
    typeRulesPrompt += `\n- Question ${index + 1}: Must be type "${rule.type}"`;
  });

  const prompt = `You are an expert exam designer.\n${LANGUAGE_RULES}\nDrafted Questions:\n${state.draftedQuestions}\nContext:\n${context}\nExpected Question Types:\n${typeRulesPrompt}\nRules:\n1. Same number of questions.\n2. Match the expected type for each question index.\n3. MCQ: 4 options, correctAnswer is one of them.\n4. TF: options=[], correctAnswer must be exactly "True" or "False" as a data value, regardless of document language.\n5. difficulty: Easy|Normal|Hard. measures: Memorization|Creativity|Thinking.\n6. Fill ai_explanation.\nReturn ONLY valid structured data.`;

  const response = await structuredLlm.invoke(prompt);
  return { finalExam: response };
}

function validateExamStructure(exam, requestedRules) {
  if (!exam || !Array.isArray(exam.questions) || exam.questions.length === 0) {
    return { valid: false, reason: "Exam is empty or has no questions" };
  }

  if (exam.questions.length !== requestedRules.length) {
    return {
      valid: false,
      reason: `Exam questions count (${exam.questions.length}) does not match requested count (${requestedRules.length})`,
    };
  }

  for (let i = 0; i < exam.questions.length; i++) {
    const q = exam.questions[i];
    const rule = requestedRules[i];

    if (q.type !== rule.type) {
      return {
        valid: false,
        reason: `Question ${i + 1} type mismatch: expected ${rule.type}, got ${q.type}`,
      };
    }

    if (!q.questionText || q.questionText.trim() === "") {
      return { valid: false, reason: "Question text cannot be empty" };
    }

    if (q.type === "TF") {
      if (q.questionText.trim().endsWith("?"))
        return {
          valid: false,
          reason: `TF must be a statement: ${q.questionText}`,
        };
      if (q.options?.length > 0)
        return { valid: false, reason: "TF cannot contain options" };
      if (!["True", "False"].includes(q.correctAnswer))
        return { valid: false, reason: "TF answer must be True or False" };
    }

    if (q.type === "MCQ") {
      if (!q.options || q.options.length !== 4)
        return { valid: false, reason: "MCQ must contain exactly 4 options" };
      if (new Set(q.options).size !== 4)
        return {
          valid: false,
          reason: "MCQ options must not contain duplicates",
        };
      // Self-healing of correctAnswer to align it with option text
      let ans = q.correctAnswer?.toString().trim();
      let opts = q.options.map(opt => opt?.toString().trim());

      // If strict match fails, try healing
      if (!opts.includes(ans)) {
        // Try case-insensitive matching
        const matchIdx = opts.findIndex(opt => opt.toLowerCase() === ans.toLowerCase());
        if (matchIdx !== -1) {
          q.correctAnswer = q.options[matchIdx]; 
        } else {
          // Try letter index matching (A, B, C, D) or Arabic letters
          const letterMap = { a: 0, b: 1, c: 2, d: 3, "أ": 0, "ب": 1, "ج": 2, "د": 3 };
          const idx = letterMap[ans.toLowerCase()];
          if (idx !== undefined && q.options[idx]) {
            q.correctAnswer = q.options[idx];
          } else {
            // Try numeric index matching (1, 2, 3, 4)
            const numIdx = parseInt(ans, 10);
            if (!isNaN(numIdx) && numIdx >= 1 && numIdx <= 4 && q.options[numIdx - 1]) {
              q.correctAnswer = q.options[numIdx - 1];
            } else {
              // Try prefix/substring matching
              const prefixMatchIdx = opts.findIndex(opt => ans.includes(opt) || opt.includes(ans));
              if (prefixMatchIdx !== -1) {
                q.correctAnswer = q.options[prefixMatchIdx];
              }
            }
          }
        }
      }

      // Re-verify after healing attempts
      if (!q.options.includes(q.correctAnswer)) {
        return {
          valid: false,
          reason: `MCQ correctAnswer "${q.correctAnswer}" must exist in options: [${q.options.join(", ")}]`,
        };
      }
    }
  }

  return { valid: true };
}

async function reviewerAgent(state) {
  console.log("🤖 Agent 3: Reviewing Exam...");

  const validation = validateExamStructure(state.finalExam, state.requestedRules);

  if (!validation.valid) {
    console.log("❌ Structure validation failed:", validation.reason);
    return {
      reviewVerdict: "FAILED",
      reviewFeedback: validation.reason,
    };
  }

  const reviewQuery = state.finalExam.questions
    .map((q) => q.questionText)
    .join("\n");

  const context = state.exam_id
    ? await retrieveRelevantChunks(reviewQuery, state.exam_id, 10)
    : state.pdfContext;

  const reviewer = llm.withStructuredOutput(ReviewSchema);

  const result = await reviewer.invoke(`
Review this exam.

Check ONLY:

1. factual correctness
2. ambiguity
3. duplicate questions
4. difficulty alignment
5. explanation correctness

Exam:
${JSON.stringify(state.finalExam)}

Context:
${context}
`);

  console.log("🧐 LLM Reviewer result:", result.verdict, "Reason:", result.reason);

  return {
    reviewVerdict: result.verdict,
    reviewFeedback: result.reason,
  };
}

function routeAfterReview(state) {
  if (state.reviewVerdict === "FAILED" && state.retryCount < 3) {
    console.log(`🔄 Failed -> Regenerating (Attempt ${state.retryCount}/3)`);
    return "generator";
  }
  if (state.reviewVerdict === "FAILED") {
    console.log("❌ Max retries reached, returning best available exam");
  } else {
    console.log("✅ Review Passed");
  }
  return "end";
}

/* =========================
   COMPILED WORKFLOW
========================= */

const workflow = new StateGraph(graphState)
  .addNode("generator", generatorAgent)
  .addNode("solver", solverAgent)
  .addNode("reviewer", reviewerAgent)
  .addEdge(START, "generator")
  .addEdge("generator", "solver")
  .addEdge("solver", "reviewer")
  .addConditionalEdges("reviewer", routeAfterReview, {
    generator: "generator",
    end: END,
  });

export const examWorkflow = workflow.compile();
