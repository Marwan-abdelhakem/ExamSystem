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
    // Pass pdfContext directly — avoids vector search (retrieveRelevantChunks) which requires paid embeddings
    const finalState = await examWorkflow.invoke({ pdfContext: fullPDFText, requestedRules: dynamicRules });

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
    console.log(`💾 Saved ${savedQuestions.length} questions | 💸 Current Balance: ${user.available_credits}`);

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

  // Validate PDF magic bytes (%PDF-)
  if (!file.buffer || file.buffer.length < 5 || file.buffer.slice(0, 5).toString() !== "%PDF-") {
    return res.status(400).json({
      error: "Invalid file format.",
      message: "The uploaded file does not appear to be a valid PDF. Please upload a proper PDF file.",
    });
  }

  let pdfData;
  try {
    pdfData = await pdfParse(file.buffer);
  } catch (parseError) {
    console.error("❌ PDF Parse Failed:", parseError.message);
    return res.status(400).json({
      error: "Failed to parse PDF.",
      message: "The PDF file appears to be corrupted or uses an unsupported format. Please try a different file.",
    });
  }

  try {
    const rawText = pdfData.text;
    if (!rawText || rawText.trim() === "") return res.status(400).json({ error: "Failed to extract text from PDF.", message: "The PDF file contains no readable text. Please upload a text-based PDF (not a scanned image)." });

    const chunks = await splitTextIntoChunks(rawText);
    console.log(`📦 Total Chunks: ${chunks.length}`);

    const examId = new mongoose.Types.ObjectId();
    // Store chunks as plain text — no embeddings needed (pipeline uses smart context sampling)
    await PDFChunk.insertMany(chunks.map(chunk => ({ exam_id: examId, chunk_text: chunk, embedding: [] })));


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

    const numOfQuestion = await QuestionModel.countDocuments({ examID: examId });
    
    // Calculate keep forever cost if applicable
    const isKeepForever = !examDetails.deletion_at;
    let keepForeverDeduction = 0;
    if (isKeepForever && user.subscription_type !== "free") {
      keepForeverDeduction = user.role === "Student" ? 10 : 15;
    }

    const totalDeduction = numOfQuestion + keepForeverDeduction;

    if (user.available_credits < totalDeduction) {
      return next(new Error(`Insufficient credits. You need ${totalDeduction} credits (Generation: ${numOfQuestion}, Keep Forever: ${keepForeverDeduction}), but you only have ${user.available_credits}.`));
    }

    user.available_credits -= totalDeduction;
    await user.save();
    console.log(`💸 Deducted ${totalDeduction} credits from ${user.name} (Generation: ${numOfQuestion}, Keep Forever: ${keepForeverDeduction}). New balance: ${user.available_credits}`);

    const exam = await ExamModel.create({
      _id: examId,
      ...examDetails,
      numOfQuestion,
      groupID: groupIDsArray,
      paidKeepForever: isKeepForever && user.subscription_type !== "free",
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

    const examsWithDifficulty = await Promise.all(
      exams.map(async (exam) => {
        const questions = await QuestionModel.find({ examID: exam._id }).select("difficulty");
        let difficulty = "Varied";
        if (questions.length > 0) {
          const uniqueDifficulties = [...new Set(questions.map((q) => q.difficulty))];
          if (uniqueDifficulties.length === 1) {
            difficulty = uniqueDifficulties[0];
          }
        }
        return {
          ...exam.toObject(),
          difficulty,
        };
      })
    );

    return res.status(200).json({ success: true, data: examsWithDifficulty });
  } catch (error) {
    return next(error);
  }
};

/* =========================
   SERVICE: TOGGLE KEEP FOREVER
========================= */

export const toggleKeepForever = async (req, res, next) => {
  const { examId } = req.params;
  const userId = req.user._id;

  try {
    const exam = await ExamModel.findOne({ _id: examId, teacherID: userId });
    if (!exam) return res.status(404).json({ error: "Exam not found or unauthorized." });

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).json({ error: "User not found." });

    const currentlyPermanent = !exam.deletion_at;

    if (currentlyPermanent) {
      // Cancel Keep Forever -> Set expiration date (e.g. user.subscription_expires_at or end of the current month)
      let deletionDate = user.subscription_expires_at;
      if (!deletionDate || new Date(deletionDate) <= new Date()) {
        // Fallback to the end of the current month
        deletionDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59);
      }

      exam.deletion_at = deletionDate;
      await exam.save();

      return res.status(200).json({
        success: true,
        message: `Keep Forever cancelled. The exam will now expire and be deleted on ${deletionDate.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}.`,
        deletion_at: exam.deletion_at,
        isPermanent: false,
      });
    } else {
      // Enable Keep Forever -> Charge credits ONLY if they haven't paid yet!
      if (exam.paidKeepForever) {
        exam.deletion_at = undefined;
        await exam.save();

        return res.status(200).json({
          success: true,
          message: "Exam set to Keep Forever successfully (Re-activated, no credits deducted).",
          deletion_at: null,
          isPermanent: true,
          remainingCredits: user.available_credits,
        });
      }

      // First time enabling Keep Forever -> Charge credits (10 for Student, 15 for Teacher)
      const isStudent = user.role === "Student";
      const cost = isStudent ? 10 : 15;

      if (user.subscription_type === "free") {
        return res.status(400).json({
          error: "Action not allowed",
          message: "Free tier users cannot keep exams forever. Please upgrade your plan."
        });
      }

      if (user.available_credits < cost) {
        return res.status(400).json({
          error: "Insufficient credits",
          message: `Re-enabling Keep Forever costs ${cost} credits, but you only have ${user.available_credits}.`
        });
      }

      user.available_credits -= cost;
      await user.save();

      exam.deletion_at = undefined;
      exam.paidKeepForever = true; // Mark as paid so they aren't charged again
      await exam.save();

      return res.status(200).json({
        success: true,
        message: "Exam set to Keep Forever successfully.",
        deletion_at: null,
        isPermanent: true,
        remainingCredits: user.available_credits,
      });
    }
  } catch (error) {
    return next(error);
  }
};

export const updateExam = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const { title, durationMinutes, openingAt, closingAt, groupID } = req.body;
    const teacherId = req.user._id;

    const exam = await ExamModel.findOne({ _id: examId, teacherID: teacherId });
    if (!exam) return res.status(404).json({ error: "Exam Not Found" });

    if (title) exam.title = title;
    if (durationMinutes !== undefined) exam.durationMinutes = durationMinutes;
    if (openingAt !== undefined) exam.openingAt = openingAt;
    if (closingAt !== undefined) exam.closingAt = closingAt;
    if (groupID !== undefined) {
      exam.groupID = groupID ? [groupID] : [];
    }

    await exam.save();

    const populatedExam = await ExamModel.findById(exam._id).populate("groupID", "groupName subject");

    return res.status(200).json({
      success: true,
      message: "Exam Updated Successfully",
      data: populatedExam,
    });
  } catch (error) {
    return next(error);
  }
};

export const deleteExam = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const teacherId = req.user._id;

    const exam = await ExamModel.findOneAndDelete({ _id: examId, teacherID: teacherId });
    if (!exam) return res.status(404).json({ error: "Exam Not Found" });

    await QuestionModel.deleteMany({ examID: examId });
    await PDFChunk.deleteMany({ exam_id: examId });

    return res.status(200).json({
      success: true,
      message: "Exam Deleted Successfully",
    });
  } catch (error) {
    return next(error);
  }
};
