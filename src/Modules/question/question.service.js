import QuestionModel from "../../DB/model/question.model.js";
import ExamModel from "../../DB/model/exam.model.js";
import successResponse from "../../Utlis/successRespone.utlis.js";

export const getQuestionsByExamId = async (req, res, next) => {
  const { examId } = req.params;
  try {
    const exam = await ExamModel.findById(examId);
    const targetExamId = (exam && exam.parentExamID) ? exam.parentExamID : examId;
    const questions = await QuestionModel.find({ examID: targetExamId });
    if (!questions || questions.length === 0) {
      return successResponse({
        res,
        success: true,
        message: "No questions found for this exam",
        data: [],
      });
    }
    return successResponse({
      res,
      success: true,
      message: "Questions retrieved successfully",
      data: questions,
    });
  } catch (error) {
    return next(error);
  }
};

export const upDateQuestion = async (req, res, next) => {
  const {
    questionId,
    title,
    typeQue,
    difficulty,
    cognitiveLevel,
    correctAnswer,
    options,
  } = req.body;

  const updatedQuestion = await QuestionModel.findByIdAndUpdate(
    questionId,
    {
      title,
      typeQue,
      difficulty,
      cognitiveLevel,
      correctAnswer,
      options,
    },
    {
      new: true,
      runValidators: true,
      context: "query",
    },
  );

  if (!updatedQuestion) {
    return next(new Error("Question Not Found"));
  }

  return successResponse({
    res,
    success: true,
    message: "Question Updated Successfully",
    data: updatedQuestion,
  });
};

export const deleteQuestion = async (req, res, next) => {
  const { questionId } = req.body;
  const question = await QuestionModel.findByIdAndDelete(questionId);
  if (!question) {
    return next(new Error("Question Not Found"));
  }
  return successResponse({
    res,
    success: true,
    message: "Question Deleted Successfully",
    data: question,
  });
};
