import QuestionModel from "../../DB/model/question.model.js";
import successResponse from "../../Utlis/successRespone.utlis.js";

export const getQuestionsByExamId = async (req, res, next) => {
  const { examId } = req.params;
  try {
    const questions = await QuestionModel.find({ examID: examId });
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
  const questionModel = await QuestionModel.findByIdAndUpdate(questionId, {
    title,
    typeQue,
    difficulty,
    cognitiveLevel,
    correctAnswer,
    options,
  });
  if (!questionModel) {
    return next(new Error("Question Not Found"));
  }
  questionModel.title = title;
  questionModel.typeQue = typeQue;
  questionModel.difficulty = difficulty;
  questionModel.cognitiveLevel = cognitiveLevel;
  questionModel.correctAnswer = correctAnswer;
  questionModel.options = options;
  await questionModel.save();
  return successResponse({
    success: true,
    message: "Question Updated Successfully",
    data: questionModel,
  });
};

export const deleteQuestion = async (req, res, next) => {
  const { questionId } = req.body;
  const question = await QuestionModel.findByIdAndDelete(questionId);
  if (!question) {
    return next(new Error("Question Not Found"));
  }
  return successResponse({
    success: true,
    message: "Question Deleted Successfully",
    data: question,
  });
};
