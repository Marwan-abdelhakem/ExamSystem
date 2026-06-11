import Joi from "joi";
import { Types } from "mongoose";

const objectId = Joi.string().custom((value, helper) => {
    if (!Types.ObjectId.isValid(value)) {
        return helper.message("Invalid ID format");
    }
    return value;
});

export const startExamValidation = Joi.object({
    examId: objectId.required(),
    accessCode: Joi.string().optional().allow(""),
});


export const submitExamValidation = Joi.object({
    attemptId: objectId.required(),
    answers: Joi.array()
        .items(
            Joi.object({
                questionId: objectId.required(),
                studentAnswer: Joi.string().allow(null, "").required(),
            })
        )
        .min(1)
        .required(),
});
