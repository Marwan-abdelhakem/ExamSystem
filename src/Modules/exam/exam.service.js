import mongoose from "mongoose";
import pdfParse from "pdf-parse-fork";
import PDFChunk from "../../DB/model/pdfChunk.model.js";
import QuestionModel from "../../DB/model/question.model.js";
import ExamModel from "../../DB/model/exam.model.js";
import GroupModel from "../../DB/model/group.model.js";
import UserModel from "../../DB/model/user.model.js";
import { examWorkflow, embeddings, generateExamRulesDynamically, splitTextIntoChunks } from "./exam.pipeline.js";

export { downloadExamPDF } from "./exam.pdf.js";

/* =========================
   SERVICE: GENERATE EXAM (AI)
========================= */

export const generateExam = async (req, res) => {
  const { examId, totalQuestions, mcqCount, difficulty } = req.body;
  const userId = req.user?._id || req.body.userId;

  if (!userId) return res.status(401).json({ error: "Unauthorized access. User ID is missing." });

  try {
    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const examCost = totalQuestions;
    console.log(`👤 User: ${user.name} | Balance: ${user.available_credits} | Cost: ${examCost}`);

    if (user.available_credits < examCost) {
      return res.status(402).json({
        error: "Insufficient credits",
        message: `This exam costs ${examCost} credits, but you only have ${user.available_credits}.`,
      });
    }

    const dbChunks = await PDFChunk.find({ exam_id: examId });
    if (dbChunks.length === 0) return res.status(404).json({ error: "No PDF chunks found." });

    // Smart context sampling
    const totalChunks = dbChunks.length;
    let selectedChunks = [];
    if (totalChunks <= totalQuestions * 2) {
      selectedChunks = dbChunks.map((c) => c.chunk_text);
    } else {
      const step = Math.floor(totalChunks / totalQuestions);
      for (let i = 0; i < totalQuestions; i++) {
        selectedChunks.push(dbChunks[Math.min(i * step, totalChunks - 1)].chunk_text);
      }
    }
    const fullPDFText = selectedChunks.join("\n\n");
    console.log(`🎯 Smart Context: ${selectedChunks.length}/${totalChunks} chunks | ${fullPDFText.length} chars`);

    const dynamicRules = generateExamRulesDynamically(totalQuestions, mcqCount, difficulty);
    const finalState = await examWorkflow.invoke({ examId, pdfContext: fullPDFText, requestedRules: dynamicRules });

    console.log("✅ Exam Generated Successfully");

    const questionsToSave = finalState.finalExam.questions.map((q) => ({
      title: q.questionText,
      options: q.options ?? [],
      correctAnswer: q.correctAnswer,
      difficulty: q.difficulty ?? "Normal",
      cognitiveLevel: q.measures ?? "Memorization",
      examID: new mongoose.Types.ObjectId(examId),
      typeQue: q.type,
      ai_explanation: q.ai_explanation ?? null,
    }));

    const savedQuestions = await QuestionModel.insertMany(questionsToSave);
    user.available_credits -= examCost;
    await user.save();
    console.log(`💾 Saved ${savedQuestions.length} questions | 💸 New Balance: ${user.available_credits}`);

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
  if (!file) return res.status(400).json({ error: "Missing pdfFile in request." });

  try {
    const pdfData = await pdfParse(file.buffer);
    const rawText = pdfData.text;
    if (!rawText || rawText.trim() === "") return res.status(400).json({ error: "Failed to extract text from PDF." });

    const chunks = await splitTextIntoChunks(rawText);
    console.log(`📦 Total Chunks: ${chunks.length}`);

    const examId = new mongoose.Types.ObjectId();
    for (const chunk of chunks) {
      const vector = await embeddings.embedQuery(chunk);
      await PDFChunk.create({ exam_id: examId, chunk_text: chunk, embedding: vector });
    }

    console.log("✅ PDF Uploaded Successfully");
    return res.status(201).json({ success: true, message: "PDF processed and stored.", examId, chunksCount: chunks.length });
  } catch (error) {
    console.error("❌ Upload Failed:", error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
};

/* =========================
   SERVICE: GENERATE MANUALLY
========================= */

export const generateExamManually = async (req, res, next) => {
  const { examDetails, questions } = req.body;
  const { groupId } = req.query;

  if (!groupId) return next(new Error("Group ID is required"));
  if (!groupId.match(/^[a-f\d]{24}$/i)) return next(new Error("Invalid Group ID format"));

  const group = await GroupModel.findById(groupId);
  if (!group) return next(new Error("Group Not Found"));

  try {
    const exam = await ExamModel.create({ ...examDetails, numOfQuestion: questions.length, groupID: [groupId] });
    const createdQuestions = await QuestionModel.insertMany(questions.map((q) => ({ ...q, examID: exam._id })));
    return res.status(201).json({ success: true, message: "Exam and Questions Created Successfully", data: { exam, questions: createdQuestions } });
  } catch (error) {
    return next(error);
  }
};

/* =========================
   SERVICE: PUBLISH AI EXAM
========================= */

export const publishAIExam = async (req, res, next) => {
  let { examId, examDetails } = req.body;
  const { groupId } = req.query;

  const isStudent = req.user.role === "Student";
  let groupIDsArray = [];

  if (groupId) {
    if (!groupId.match(/^[a-f\d]{24}$/i)) return next(new Error("Invalid Group ID format"));
    const group = await GroupModel.findById(groupId);
    if (!group) return next(new Error("Group Not Found"));
    groupIDsArray.push(groupId);
  } else if (!isStudent) {
    return next(new Error("Group ID is required"));
  }

  try {
    const existingExam = await ExamModel.findById(examId);
    if (existingExam) {
      if (groupId) {
        if (!Array.isArray(existingExam.groupID)) {
          existingExam.groupID = existingExam.groupID ? [existingExam.groupID] : [];
        }
        if (!existingExam.groupID.map(id => id.toString()).includes(groupId.toString())) {
          existingExam.groupID.push(groupId);
          await existingExam.save();
        }
      }
      const user = await UserModel.findById(existingExam.teacherID).select("available_credits");
      return res.status(200).json({
        success: true,
        message: "Exam assigned to group successfully",
        remainingCredits: user?.available_credits ?? null,
        data: { exam: existingExam },
      });
    }

    const user = await UserModel.findById(examDetails.teacherID);
    if (!user) return next(new Error("User Not Found"));

    const isKeepForever = !examDetails.deletion_at;
    if (isKeepForever && user.subscription_type !== "free") {
      const deductionAmount = user.role === "Student" ? 10 : 15;
      if (user.available_credits < deductionAmount) {
        return next(new Error(`Insufficient credits to keep exam forever. You need ${deductionAmount} credits, but you only have ${user.available_credits}.`));
      }
      user.available_credits -= deductionAmount;
      await user.save();
      console.log(`💸 Deducted ${deductionAmount} credits from ${user.name} to keep exam forever. New balance: ${user.available_credits}`);
    }

    const numOfQuestion = await QuestionModel.countDocuments({ examID: examId });
    const exam = await ExamModel.create({
      _id: examId,
      ...examDetails,
      numOfQuestion,
      groupID: groupIDsArray,
    });

    return res.status(201).json({
      success: true,
      message: "AI Exam Published Successfully",
      remainingCredits: user.available_credits,
      data: { exam },
    });
  } catch (error) {
    return next(error);
  }
};

/* =========================
   SERVICE: UPDATE STATUS
========================= */

export const updateExamStatus = async (req, res, next) => {
  const { examId } = req.params;
  const { status } = req.body;
  const validStatuses = ["Active", "Closed", "Hidden"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
  }

  try {
    const exam = await ExamModel.findOneAndUpdate(
      { _id: examId, teacherID: req.user._id },
      { status },
      { new: true }
    );
    if (!exam) return res.status(404).json({ message: "Exam not found or unauthorized" });
    return res.status(200).json({ success: true, message: `Status updated to ${status}`, data: exam });
  } catch (error) {
    return next(error);
  }
};

/* =========================
   SERVICE: GET MY EXAMS
========================= */

export const getMyExams = async (req, res, next) => {
  try {
    const exams = await ExamModel.find({ teacherID: req.user._id })
      .populate("groupID", "groupName subject")
      .sort({ createdAt: -1 });
    return res.status(200).json({ success: true, data: exams });
  } catch (error) {
    return next(error);
  }
};
