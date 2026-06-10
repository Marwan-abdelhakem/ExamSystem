import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { StateGraph, END, START } from "@langchain/langgraph";
import { ExamSchema } from "./exam.validation.js";
import mongoose from "mongoose";
import pdfParse from "pdf-parse-fork";
import PDFChunk from "../../DB/model/pdfChunk.model.js";
import QuestionModel from "../../DB/model/question.model.js";
import ExamModel from "../../DB/model/exam.model.js";
import GroupModel from "../../DB/model/group.model.js";
import puppeteer from "puppeteer";
import { examPdfQueue } from "../../Utlis/concurrencyQueue.utlis.js";

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

QUESTION TYPE FORMATTING RULES:

MCQ:
- Generate a direct question.
- Must contain exactly 4 options.
- Only one option can be correct.
- Do not reveal the answer in the question.

TF:
- Generate a declarative statement, NOT a question.
- The statement must be answerable with True or False only.
- Do NOT use:
  - Why
  - How
  - Explain
  - Describe
  - What is
  - Open-ended questions
- Do NOT end the statement with a question mark (?).

Examples:

Valid TF:
✓ React uses a Virtual DOM to improve rendering performance.
✓ useEffect can be used for side effects in React.

Invalid TF:
✗ Why is the Virtual DOM faster than the Real DOM?
✗ Explain how useEffect works.
✗ How does React update the UI?

Use this FULL PDF context:
${state.pdfContext}

The cognitive level (Measures) must influence the question itself.
Memorization:
- Focus on facts, definitions, concepts.
Thinking:
- Focus on understanding, analysis, comparison, reasoning.
Creativity:
- Focus on applying concepts in new situations, problem solving, or scenario-based thinking.

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
5. difficulty: Easy | Normal | Hard.
6. measures: Memorization | Creativity | Thinking.
7. ai_explanation must explain why the answer is correct.
8. Never leave any field empty.

Return ONLY valid structured data.
`;

  const response = await structuredLlm.invoke(prompt);
  return { finalExam: response };
}

/* =========================
   Validation Function
========================= */

function validateExamStructure(exam) {
  for (const question of exam.questions) {
    if (question.type === "TF") {
      if (question.questionText.trim().endsWith("?")) {
        return {
          valid: false,
          reason: `TF question must be a statement: ${question.questionText}`,
        };
      }

      if (question.options && question.options.length > 0) {
        return {
          valid: false,
          reason: `TF question cannot contain options`,
        };
      }

      if (!["True", "False"].includes(question.correctAnswer)) {
        return {
          valid: false,
          reason: `TF answer must be True or False`,
        };
      }
    }

    if (question.type === "MCQ") {
      if (!question.options || question.options.length !== 4) {
        return {
          valid: false,
          reason: `MCQ must contain exactly 4 options`,
        };
      }

      if (!question.options.includes(question.correctAnswer)) {
        return {
          valid: false,
          reason: `MCQ correct answer must exist in options`,
        };
      }
    }
  }
  return {
    valid: true,
  };
}

/* =========================
   AGENT: REVIEWER
========================= */

async function reviewerAgent(state) {
  console.log("🤖 Agent 3: Reviewing Exam...");

  const validation = validateExamStructure(state.finalExam);

  if (!validation.valid) {
    return {
      reviewVerdict: "FAILED",
      reviewFeedback: validation.reason,
    };
  }

  const prompt = `
You are a senior academic reviewer.

Exam:
${JSON.stringify(state.finalExam)}

Original PDF Context:
${state.pdfContext}

Review the exam carefully.

Check ONLY:

1. Factual correctness against the PDF context.
2. Ambiguous or misleading questions.
3. Duplicate or highly similar questions.
4. Coverage of the document.
5. Difficulty alignment (Easy / Normal / Hard).
6. Cognitive level alignment
   (Memorization / Thinking / Creativity).
7. Correctness of explanations.

IMPORTANT:
- Ignore formatting completely.
- Ignore number of options.
- Ignore TF/MCQ structure.
- Those are already validated by code.

Return exactly one of:

PASSED

or

FAILED: <clear reason>
`;

  const response = await llm.invoke(prompt);

  const result = response.content.toString().trim();

  if (result.toUpperCase().startsWith("FAILED")) {
    return {
      reviewVerdict: "FAILED",
      reviewFeedback: result,
    };
  }

  return {
    reviewVerdict: "PASSED",
  };
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
  const userId = req.user?._id || req.body.userId;

  console.log("BODY =>", req.body);

  if (!userId) {
    return res
      .status(401)
      .json({ error: "Unauthorized access. User ID is missing." });
  }

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    const examCost = totalQuestions;

    console.log(
      `👤 User: ${user.name} | Balance: ${user.available_credits} | Exam Cost: ${examCost}`,
    );

    if (user.available_credits < examCost) {
      return res.status(402).json({
        error: "Insufficient credits",
        message: `This exam costs ${examCost} credits, but you only have ${user.available_credits}. Please top up.`,
      });
    }
    console.log(`🔍 Fetching chunks for exam ${examId}`);
    const dbChunks = await PDFChunk.find({ exam_id: examId });

    if (dbChunks.length === 0) {
      return res.status(404).json({ error: "No PDF chunks found." });
    }

    let selectedTextChunks = [];
    const totalChunks = dbChunks.length;
    const targetQuestionsCount = totalQuestions;

    if (totalChunks <= targetQuestionsCount * 2) {
      selectedTextChunks = dbChunks.map((chunk) => chunk.chunk_text);
    } else {
      const step = Math.floor(totalChunks / targetQuestionsCount);
      for (let i = 0; i < targetQuestionsCount; i++) {
        const chunkIndex = Math.min(i * step, totalChunks - 1);
        selectedTextChunks.push(dbChunks[chunkIndex].chunk_text);
      }
    }
    const fullPDFText = selectedTextChunks.join("\n\n");
    console.log(
      `🎯 Smart Context Ready. Sampled Chunks: ${selectedTextChunks.length}/${totalChunks} | Length: ${fullPDFText.length} chars`,
    );

    const dynamicRules = generateExamRulesDynamically(
      totalQuestions,
      mcqCount,
      difficulty,
    );

    const app = workflow.compile();
    const finalState = await app.invoke({
      examId,
      pdfContext: fullPDFText,
      requestedRules: dynamicRules,
    });

    console.log("✅ Exam Generated Successfully");
    const difficultyMap = { Easy: "Easy", Normal: "Normal", Hard: "Hard" };
    const measuresMap = {
      Memorization: "Memorization",
      Creativity: "Creativity",
      Thinking: "Thinking",
    };

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
    user.available_credits -= examCost;
    await user.save();
    console.log(
      `💸 Deducted ${examCost} credits. New Balance: ${user.available_credits}`,
    );
    return res.status(200).json({
      verdict: finalState.reviewVerdict,
      savedCount: savedQuestions.length,
      questions: savedQuestions,
      remainingCredits: user.available_credits,
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
      return res
        .status(400)
        .json({ error: "Failed to extract text from PDF." });
    }

    console.log("📚 Splitting into chunks...");
    const chunks = splitTextIntoChunks(rawText);
    console.log(`📦 Total Chunks: ${chunks.length}`);

    const examId = new mongoose.Types.ObjectId();

    for (const chunk of chunks) {
      console.log("🧠 Generating embedding...");
      const vector = await embeddings.embedQuery(chunk);
      await PDFChunk.create({
        exam_id: examId,
        chunk_text: chunk,
        embedding: vector,
      });
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
    const numOfQuestion = await QuestionModel.countDocuments({
      examID: examId,
    });

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

export const getMyExams = async (req, res, next) => {
  try {
    const exams = await ExamModel.find({ teacherID: req.user._id })
      .populate("groupID", "groupName subject")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: exams,
    });
  } catch (error) {
    return next(error);
  }
};

export const downloadExamPDF = async (req, res, next) => {
  const { examId } = req.params;
  const showAnswers = req.query.showAnswers === "true";

  try {
    const exam = await ExamModel.findById(examId);
    if (!exam) {
      return res.status(404).json({ error: "Exam not found." });
    }

    const questions = await QuestionModel.find({ examID: examId });
    let questionsHtml = "";

    questions.forEach((q, index) => {
      let optionsHtml = "";
      let badgeClass = "badge-normal";
      if (q.difficulty === "Easy") badgeClass = "badge-easy";
      if (q.difficulty === "Hard") badgeClass = "badge-hard";

      if (q.typeQue === "MCQ" && q.options) {
        optionsHtml = `
          <div class="options-grid">
            ${q.options
              .map((opt, i) => {
                const optionChar = String.fromCharCode(65 + i);
                const isCorrect = opt === q.correctAnswer;
                const activeClass =
                  showAnswers && isCorrect ? "option correct" : "option";
                const checkRadio = showAnswers && isCorrect ? "●" : " ";

                return `
                <div class="${activeClass}">
                  <span class="radio-indicator">${checkRadio}</span>
                  <span class="option-letter">${optionChar}</span>
                  <span class="option-text">${opt}</span>
                </div>
              `;
              })
              .join("")}
          </div>
        `;
      } else {
        const isTrueCorrect = q.correctAnswer === "True";
        const isFalseCorrect = q.correctAnswer === "False";

        optionsHtml = `
          <div class="options-grid">
            <div class="option ${showAnswers && isTrueCorrect ? "correct" : ""}">
              <span class="radio-indicator">${showAnswers && isTrueCorrect ? "●" : " "}</span>
              <span class="option-text">صح / True</span>
            </div>
            <div class="option ${showAnswers && isFalseCorrect ? "correct" : ""}">
              <span class="radio-indicator">${showAnswers && isFalseCorrect ? "●" : " "}</span>
              <span class="option-text">خطأ / False</span>
            </div>
          </div>
        `;
      }

      const explanationHtml =
        showAnswers && q.ai_explanation
          ? `
        <div class="ai-explanation">
          <div class="ai-exp-title">✨ AI Explanation</div>
          <div class="ai-exp-text">${q.ai_explanation}</div>
        </div>
      `
          : "";

      questionsHtml += `
        <div class="question-block">
          <div class="question-title">
            <span class="question-number">السؤال ${index + 1}:</span> ${q.title} 
            ${
              showAnswers
                ? `
              <span class="badge ${badgeClass}">${q.difficulty}</span>
              <span class="badge badge-cognitive">${q.cognitiveLevel}</span>
            `
                : ""
            }
          </div>
          ${optionsHtml}
          ${explanationHtml}
        </div>
      `;
    });

    const finalHtmlContent = `
      <!DOCTYPE html>
      <html lang="ar">
      <head>
        <meta charset="UTF-8">
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
       <style>
          body { 
            font-family: 'Cairo', sans-serif; 
            padding: 10px; 
            color: #1e293b; 
            direction: rtl; 
            text-align: right; 
            background-color: #ffffff; 
            font-size: 13px;
          }
          
          .header-container { 
            border: 1.5px solid #16305b; 
            border-radius: 8px; 
            padding: 12px 18px; 
            margin-bottom: 20px; 
            background-color: #f8fafc; 
          }
          .exam-title { 
            text-align: center; 
            color: #16305b; 
            font-size: 20px; 
            font-weight: bold; 
            margin: 0 0 10px 0; 
            border-bottom: 1.5px solid #e2e8f0; 
            padding-bottom: 6px; 
          }
          .meta-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr 1fr; 
            gap: 10px; 
            font-size: 12px; 
            font-weight: bold; 
            color: #475569; 
          }
          
          .student-info-box { 
            display: ${showAnswers ? "none" : "grid"}; 
            grid-template-columns: 2fr 1fr 1fr; 
            gap: 15px; 
            margin-top: 10px; 
            padding-top: 10px; 
            border-top: 1px dashed #cbd5e1; 
          }
          .info-field { 
            font-size: 11px; 
            font-weight: bold; 
            color: #64748b; 
            border-bottom: 1px solid #cbd5e1; 
            padding-bottom: 2px; 
          }
          .question-block { 
            margin-bottom: 15px; 
            padding: 12px 15px;  
            border: 1px solid #e2e8f0; 
            border-radius: 8px; 
            background-color: #ffffff; 
            page-break-inside: avoid;
          }
          .question-title { 
            font-size: 14px; 
            font-weight: bold; 
            margin-bottom: 10px; 
            color: #0f172a; 
            line-height: 1.5; 
          }
          .question-number { 
            color: #16305b; 
            font-size: 15px; 
          }
          .badge { 
            font-size: 9px; 
            padding: 1px 8px; 
            border-radius: 12px; 
            font-weight: bold; 
            display: inline-block; 
          }
          .badge-easy { background-color: #dcfce7; color: #15803d; }
          .badge-normal { background-color: #dbeafe; color: #1d4ed8; }
          .badge-hard { background-color: #ffedd5; color: #c2410c; }
          .badge-cognitive { background-color: #f3e8ff; color: #6b21a8; margin-right: 3px; }
          .options-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 8px; 
            margin-top: 8px; 
          }
          .option { 
            display: flex; 
            align-items: center; 
            padding: 6px 12px;
            border: 1px solid #e2e8f0; 
            border-radius: 6px; 
            font-size: 12px; 
            background-color: #f8fafc; 
            gap: 8px; 
          }
          .option.correct { 
            border-color: #16305b; 
            background-color: #eff6ff; 
            color: #16305b; 
            font-weight: bold; 
          }
          .radio-indicator { 
            width: 11px; 
            height: 11px; 
            border: 1.5px solid #cbd5e1; 
            border-radius: 50%; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-size: 10px; 
            color: #16305b; 
            font-weight: bold; 
            background-color: #ffffff; 
          }
          .option.correct .radio-indicator { border-color: #16305b; }
          .option-letter { font-weight: bold; color: #64748b; margin-left: 3px; }
          .option.correct .option-letter { color: #16305b; 
          .ai-explanation { 
            margin-top: 10px; 
            padding: 8px 12px; 
            background-color: #faf5ff; 
            border-right: 3px solid #8b5cf6; 
            border-radius: 4px; 
            font-size: 11px;
            color: #5b21b6; 
            line-height: 1.5; 
          }
          .ai-exp-title { 
            font-weight: bold; 
            font-size: 12px; 
            margin-bottom: 3px; 
            color: #6b21a8; 
          }
          .ai-exp-text { font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="header-container">
          <h1 class="exam-title">${exam.title}</h1>
          <div class="meta-grid">
            <div class="meta-item">📚 المادة: ${exam.subject || "General Science"}</div>
            <div class="meta-item">⏱️ المدة: ${exam.durationMinutes} دقيقة</div>
            <div class="meta-item">📝 الأسئلة: ${questions.length} أسئلة</div>
          </div>

          <div class="student-info-box">
            <div class="info-field">اسم الطالب: ................................................................</div>
            <div class="info-field">الفصل: ..................</div>
            <div class="info-field">التاريخ: .............</div>
          </div>
        </div>
        
        <div class="exam-body">
          ${questionsHtml}
        </div>
      </body>
      </html>
    `;

    console.log("⏱️ Sending PDF task to the Concurrency Queue...");

    const pdfBuffer = await examPdfQueue.run(async () => {
      console.log(
        `🚀 Launching Headless Chrome... Active: ${examPdfQueue.runningCount}/${examPdfQueue.maxConcurrency}`,
      );

      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(finalHtmlContent, { waitUntil: "networkidle0" });

      console.log("📄 Exporting page to PDF Buffer with Headers & Footers...");
      const buffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", right: "20mm", bottom: "25mm", left: "20mm" },

        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size:0px;"></div>',
        footerTemplate: `
          <div style="font-size: 10px; color: #94a3b8; font-family: 'Cairo', sans-serif; width: 100%; display: flex; justify-content: space-between; padding: 0 20mm; box-sizing: border-box; direction: rtl;">
            <span>Aigentic AI Exam Generator - Where Agents Craft Your Success</span>
            <span>صفحة <span class="pageNumber"></span> من <span class="totalPages"></span></span>
          </div>
        `,
      });

      await browser.close();
      return buffer;
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${exam.title.replace(/\s+/g, "_")}_Exam.pdf`,
    );
    return res.send(pdfBuffer);
  } catch (error) {
    console.error("❌ PDF Generation Failed:", error.message);
    return next(error);
  }
};
