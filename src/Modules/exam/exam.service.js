import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { StateGraph, END, START } from "@langchain/langgraph";
import { ExamSchema } from "./exam.validation.js";
import mongoose from "mongoose";
import pdfParse from "pdf-parse-fork";
import PDFChunk from "../../DB/model/pdfChunk.model.js";
import QuestionModel from "../../DB/model/question.model.js";
import ExamModel from "../../DB/model/exam.model.js";
import GroupModel from "../../DB/model/group.model.js";

/* =========================
   LLM & EMBEDDINGS
========================= */

const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
    temperature: 0.1,
    apiKey: process.env.API_KEY,
});

const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    apiKey: process.env.API_KEY,
});


/* =========================
   GRAPH STATE
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
    },
};

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
   LANGUAGE RULES PROMPT
========================= */

const LANGUAGE_RULES = `
LANGUAGE PRESERVATION RULES:
1. Detect the original language of the provided document context.
2. ALL generated content MUST use the same language as the source document.
3. Never translate technical terms, framework names, library names, APIs, product names, function names, class names, variables, or foreign-language terms that appear in the source document.
4. Preserve terminology exactly as it appears in the document.
5. If the document is Arabic and contains English, Turkish, French, German, or technical terms, keep those terms unchanged.
6. Questions, options, answers, and explanations must follow the same writing style and language used in the source document.
7. Do not normalize or rewrite terminology into another language.
8. If the document mixes multiple languages, preserve the same mixture naturally.
9. The generated exam should feel as if it was written by the author of the source document.
10. Never answer in a language different from the source document language.

CRITICAL RULE:
The output language MUST match the document language exactly.
Arabic document → Arabic output.
English document → English output.
French document → French output.

Keep all technical and foreign terms exactly as written in the source document.

`;

/* =========================
   HELPER: DYNAMIC RULES
========================= */

function generateExamRulesDynamically(total, mcq, clientDifficultyRules) {
    const flatRules = [];
    console.log("📊 Smart Scheduler Active");

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

/* =========================
   HELPER: SPLIT TEXT
========================= */

function splitTextIntoChunks(text, chunkSize = 1000, overlap = 200) {
    const chunks = [];
    let i = 0;
    while (i < text.length) {
        chunks.push(text.slice(i, i + chunkSize));
        i += chunkSize - overlap;
    }
    return chunks;
}

/* =========================
   AGENT: GENERATOR
========================= */

async function generatorAgent(state) {
    console.log("\n🤖 Agent 1: Generating Questions...");

    let rulesPrompt = "";
    state.requestedRules.forEach((rule, index) => {
        const matrixKey = `${rule.measures}_${rule.difficulty}`;
        rulesPrompt += `
- Question ${index + 1}
Type: ${rule.type}
Difficulty: ${rule.difficulty}
Measures: ${rule.measures}
Goal: ${cognitiveMatrix[matrixKey]}
`;
    });

    let prompt = `
You are an expert professor.
${LANGUAGE_RULES}

Use this FULL PDF context:
${state.pdfContext}

Generate exactly ${state.requestedRules.length} questions.

Rules:
${rulesPrompt}

IMPORTANT:
- Questions MUST cover DIFFERENT parts of the PDF.
- Distribute questions across the ENTIRE document.
- Avoid repeating same concepts.
- Do NOT generate answers yet.
- Only generate question drafts.
`;

    if (state.reviewVerdict === "FAILED") {
        prompt += `\nPrevious generation failed:\n${state.reviewFeedback}\n`;
    }

    const response = await llm.invoke(prompt);
    return { draftedQuestions: response.content.toString(), reviewVerdict: null };
}

/* =========================
   AGENT: SOLVER
========================= */

async function solverAgent(state) {
    console.log("🤖 Agent 2: Solving Questions...");

    const structuredLlm = llm.withStructuredOutput(ExamSchema);

    const prompt = `
You are an expert exam designer.
${LANGUAGE_RULES}

Drafted Questions:
${state.draftedQuestions}

Context:
${state.pdfContext}

Rules:
1. Generate the exact same number of questions.
2. Every question MUST contain: q_id, type, questionText, options, correctAnswer, difficulty, measures, ai_explanation.
3. MCQ: options must contain exactly 4 choices. correctAnswer must be one of the 4 options.
4. TF: options must be []. correctAnswer must be "True" or "False".
5. difficulty: Easy | Normal | Hard | Expert.
6. measures: Memorization | Creativity | Thinking.
7. ai_explanation must explain why the answer is correct.
8. Never leave any field empty.

Return ONLY valid structured data.
`;

    const response = await structuredLlm.invoke(prompt);
    return { finalExam: response };
}

/* =========================
   AGENT: REVIEWER
========================= */

async function reviewerAgent(state) {
    console.log("🤖 Agent 3: Reviewing Exam...");

    const prompt = `
Review this exam carefully:
${JSON.stringify(state.finalExam)}

Rules:
- TF has NO options
- MCQ has EXACTLY 4 options
- Answers must be correct

Return:
PASSED
or
FAILED: reason
`;

    const response = await llm.invoke(prompt);
    const result = response.content.toString();

    if (result.includes("FAILED")) {
        return { reviewVerdict: "FAILED", reviewFeedback: result };
    }
    return { reviewVerdict: "PASSED" };
}

/* =========================
   ROUTING
========================= */

function routeAfterReview(state) {
    if (state.reviewVerdict === "FAILED") {
        console.log("🔄 Failed Review -> Back to Generator");
        return "generator";
    }
    console.log("✅ Review Passed");
    return "end";
}

/* =========================
   WORKFLOW
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

/* =========================
   SERVICE: GENERATE EXAM
========================= */

export const generateExam = async (req, res) => {
    const { examId, totalQuestions, mcqCount, difficulty } = req.body;
    console.log("BODY =>", req.body);

    try {
        console.log(`🔍 Fetching chunks for exam ${examId}`);
        const dbChunks = await PDFChunk.find({ exam_id: examId });

        if (dbChunks.length === 0) {
            return res.status(404).json({ error: "No PDF chunks found." });
        }

        const fullPDFText = dbChunks.map((chunk) => chunk.chunk_text).join("\n\n");
        console.log(`✅ Full PDF Loaded (${fullPDFText.length} chars)`);

        const dynamicRules = generateExamRulesDynamically(totalQuestions, mcqCount, difficulty);

        const app = workflow.compile();
        const finalState = await app.invoke({
            examId,
            pdfContext: fullPDFText,
            requestedRules: dynamicRules,
        });

        console.log("✅ Exam Generated Successfully");

        // Map difficulty & measures to DB enums
        const difficultyMap = { Easy: "Easy", Normal: "Normal", Hard: "Hard" };
        const measuresMap = { Memorization: "Memorization", Creativity: "Creativity", Thinking: "Thinking" };

        const questionsToSave = finalState.finalExam.questions.map((q) => ({
            title: q.questionText,
            options: q.options ?? [],
            correctAnswer: q.correctAnswer,
            difficulty: difficultyMap[q.difficulty] ?? "Normal",
            cognitiveLevel: measuresMap[q.measures] ?? "Memorization",
            examID: new mongoose.Types.ObjectId(examId),
            typeQue: q.type,
            ai_explanation: q.ai_explanation ?? null,
        }));

        const savedQuestions = await QuestionModel.insertMany(questionsToSave);
        console.log(`💾 Saved ${savedQuestions.length} questions to DB`);

        return res.status(200).json({
            verdict: finalState.reviewVerdict,
            savedCount: savedQuestions.length,
            questions: savedQuestions,
        });
    } catch (error) {
        console.error("❌ Pipeline Failed:", error.message);
        return res.status(500).json({ error: error.message });
    }
};

/* =========================
   SERVICE: UPLOAD PDF
========================= */

export const uploadPDF = async (req, res) => {
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: "Missing pdfFile in request." });
    }

    try {
        console.log("🔍 Extracting text from PDF...");
        const pdfData = await pdfParse(file.buffer);
        const rawText = pdfData.text;

        if (!rawText || rawText.trim() === "") {
            return res.status(400).json({ error: "Failed to extract text from PDF." });
        }

        console.log("📚 Splitting into chunks...");
        const chunks = splitTextIntoChunks(rawText);
        console.log(`📦 Total Chunks: ${chunks.length}`);

        const examId = new mongoose.Types.ObjectId();

        for (const chunk of chunks) {
            console.log("🧠 Generating embedding...");
            const vector = await embeddings.embedQuery(chunk);
            await PDFChunk.create({ exam_id: examId, chunk_text: chunk, embedding: vector });
        }

        console.log("✅ PDF Uploaded Successfully");
        return res.status(201).json({
            success: true,
            message: "PDF processed and stored successfully.",
            examId,
            chunksCount: chunks.length,
        });
    } catch (error) {
        console.error("❌ Upload Failed:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};


/* ==================================
   SERVICE: GENERATE EXAM MANUALLY
================================== */

/*
input data {

POST /exam/generate-manually?groupId=68401234abcd5678ef901234

{
  "examDetails": {
    "title": "Final Exam - JavaScript",
    "openingAt": 1750000000,
    "closingAt": 1750003600,
    "durationMinutes": 60,
    "status": "Active",
    "teacherID": "68401234abcd5678ef901111"
  },
  "questions": [
    {
      "title": "What does 'var' do in JavaScript?",
      "options": ["Declares a variable", "Declares a function", "Imports a module", "None of the above"],
      "correctAnswer": "Declares a variable",
      "difficulty": "easy",
      "cognitiveLevel": "remember",
      "typeQue": "MCQ"
    },
    {
      "title": "JavaScript is a compiled language.",
      "options": [],
      "correctAnswer": "False",
      "difficulty": "easy",
      "cognitiveLevel": "remember",
      "typeQue": "TF"
    }
  ]
}

}

*/

export const generateExamManually = async (req, res, next) => {
    const { examDetails, questions } = req.body;
    const { groupId } = req.query;

    if (!groupId) {
        return next(new Error("Group ID is required"));
    }

    if (!groupId.match(/^[a-f\d]{24}$/i)) {
        return next(new Error("Invalid Group ID format"));
    }

    const group = await GroupModel.findById(groupId);
    if (!group) {
        return next(new Error("Group Not Found"));
    }
    try {
        const exam = await ExamModel.create({
            ...examDetails,
            numOfQuestion: questions.length,
            groupID: groupId,
        });
        const preparedQuestions = questions.map((q) => ({
            ...q,
            examID: exam._id,
        }));

        const createdQuestions = await QuestionModel.insertMany(preparedQuestions);
        return res.status(201).json({
            success: true,
            message: "Exam and Questions Created Successfully",
            data: {
                exam,
                questions: createdQuestions,
            },
        });
    } catch (error) {
        return next(error);
    }
};

export const publishAIExam = async (req, res, next) => {
    const { examId, examDetails } = req.body;
    const { groupId } = req.query;

    if (!groupId) {
        return next(new Error("Group ID is required"));
    }

    if (!groupId.match(/^[a-f\d]{24}$/i)) {
        return next(new Error("Invalid Group ID format"));
    }

    const group = await GroupModel.findById(groupId);
    if (!group) {
        return next(new Error("Group Not Found"));
    }

    try {
        const numOfQuestion = await QuestionModel.countDocuments({ examID: examId });

        const exam = await ExamModel.create({
            _id: examId,
            ...examDetails,
            numOfQuestion,
            groupID: groupId,
        });

        return res.status(201).json({
            success: true,
            message: "AI Exam Published Successfully",
            data: {
                exam,
            },
        });
    } catch (error) {
        return next(error);
    }
};
