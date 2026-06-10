import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { StateGraph, END, START } from "@langchain/langgraph";
import { ExamSchema } from "./exam.validation.js";
import { MongoClient } from "mongodb";

/* =========================
   LLM & EMBEDDINGS
========================= */

export const llm = new ChatOpenAI({
  model: "gpt-4o-mini",
  temperature: 0.1,
  apiKey: process.env.API_KEY,
});

export const embeddings = new OpenAIEmbeddings({
  model: "text-embedding-3-small",
  apiKey: process.env.API_KEY,
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
5. Questions, options, answers, and explanations must follow the same writing style and language used in the source document.
6. If the document mixes multiple languages, preserve the same mixture naturally.
CRITICAL RULE: The output language MUST match the document language exactly.
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

export function splitTextIntoChunks(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.slice(i, i + chunkSize));
    i += chunkSize - overlap;
  }
  return chunks;
}

/* =========================
   VECTOR SEARCH HELPERS
========================= */

export async function storePdfChunks(pdfText, bookId) {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    const collection = client.db("test").collection("pdf_chunks");
     await collection.deleteMany({ exam_id: examId });

    const chunks = splitTextIntoChunks(pdfText, 1000, 200);

    const docs = await Promise.all(
      chunks.map(async (chunk, i) => ({
        bookId,
        chunkIndex: i,
        text: chunk,
        embedding: await embeddings.embedQuery(chunk),
      })),
    );

    await collection.insertMany(docs);
    console.log(`✅ Stored ${docs.length} chunks for bookId: ${bookId}`);
  } finally {
    await client.close();
  }
}

export async function retrieveRelevantChunks(query, bookId, topK = 10) {
  const client = new MongoClient(process.env.MONGO_URI);
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
            filter:  { exam_id: examId },
          },
        },
        { $project: { text: 1, _id: 0 } },
      ])
      .toArray();

    return results.map((r) => r.text).join("\n\n");
  } finally {
    await client.close();
  }
}

/* =========================
   AGENTS
========================= */

const graphState = {
  channels: {
    examId: { value: (x, y) => y ?? x, default: () => null },
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

  const context = state.examId
    ? await retrieveRelevantChunks(rulesPrompt, state.examId, 10)
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
  const context = state.examId
    ? await retrieveRelevantChunks(state.draftedQuestions, state.examId, 10)
    : state.pdfContext;

  const prompt = `You are an expert exam designer.\n${LANGUAGE_RULES}\nDrafted Questions:\n${state.draftedQuestions}\nContext:\n${context}\nRules:\n1. Same number of questions.\n2. MCQ: 4 options, correctAnswer is one of them.\n3. TF: options=[], correctAnswer="True" or "False".\n4. difficulty: Easy|Normal|Hard. measures: Memorization|Creativity|Thinking.\n5. Fill ai_explanation.\nReturn ONLY valid structured data.`;

  const response = await structuredLlm.invoke(prompt);
  return { finalExam: response };
}

function validateExamStructure(exam) {
  for (const q of exam.questions) {
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
      if (!q.options.includes(q.correctAnswer))
        return {
          valid: false,
          reason: "MCQ correctAnswer must exist in options",
        };
    }
  }
  return { valid: true };
}

async function reviewerAgent(state) {
  console.log("🤖 Agent 3: Reviewing Exam...");
  const validation = validateExamStructure(state.finalExam);
  if (!validation.valid)
    return { reviewVerdict: "FAILED", reviewFeedback: validation.reason };
  const context = state.examId
    ? await retrieveRelevantChunks(
        JSON.stringify(state.finalExam),
        state.examId,
        10,
      )
    : state.pdfContext;

  const prompt = `Review this exam for factual correctness, ambiguity, duplicates, difficulty alignment, and explanation correctness.\nExam:\n${JSON.stringify(state.finalExam)}\nPDF Context:\n${context}\nReturn exactly: PASSED or FAILED: <reason>`;
  const response = await llm.invoke(prompt);
  const result = response.content.toString().trim();
  if (result.toUpperCase().startsWith("FAILED"))
    return { reviewVerdict: "FAILED", reviewFeedback: result };
  return { reviewVerdict: "PASSED" };
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
