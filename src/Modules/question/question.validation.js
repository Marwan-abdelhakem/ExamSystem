import Joi from "joi";
import { Types } from "mongoose";

export const deleteQuestionValidation = Joi.object({
    questionId: Joi.string().custom((value, helper) => {
        if (!Types.ObjectId.isValid(value)) {
            return helper.message("Invalid Question ID");
        }
        return value;
    }).required(),
})

export const validateUpdateQuestion = Joi.object({
    questionId: Joi.string().custom((value, helper) => {
        if (!Types.ObjectId.isValid(value)) {
            return helper.message("Invalid Question ID");
        }
        return value;
    }).required(),
    title: Joi.string().optional(),
    typeQue: Joi.string().enum(["MCQ", "TF"]).optional(),
    difficulty: Joi.string().enum(["Easy", "Normal", "Hard"]).optional(),
    cognitiveLevel: Joi.string().enum(["Memorization", "Creativity", "Thinking"]).optional(),
    correctAnswer: Joi.string().optional(),
    options: Joi.array().items(Joi.string()).optional(),
})