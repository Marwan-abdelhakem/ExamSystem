import QuestionModel from "../../DB/model/question.model.js";
import successResponse from "../../Utlis/successRespone.utlis.js";



export const upDateQuestion = async (req, res, next) => {
    const { questionId, title, typeQue, difficulty, cognitiveLevel, correctAnswer, options } = req.body;
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
}

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
}