import Joi from "joi";
import { z } from "zod";

export const generateExamValidation = Joi.object({
    examId: Joi.string().required(),
    totalQuestions: Joi.number().min(1).max(100).required(),
    mcqCount: Joi.number().min(0).max(Joi.ref("totalQuestions")).required(),
    difficulty: Joi.array()
        .items(
            Joi.object({
                count: Joi.number().min(1).required(),
                difficulty: Joi.string().valid("Easy", "Normal", "Hard").required(),
                measures: Joi.string()
                    .valid("Memorization", "Creativity", "Thinking")
                    .required(),
            }),
        )
        .required(),
});

export const generateExamManuallyValidation = Joi.object({
    examDetails: Joi.object({
        title: Joi.string().required(),
        openingAt: Joi.number().required(),
        closingAt: Joi.number().greater(Joi.ref("openingAt")).required(),
        durationMinutes: Joi.number().min(1).required(),
        accessCode: Joi.string().optional().allow(""),
        status: Joi.string().valid("Active", "Closed", "Hidden").required(),
        teacherID: Joi.string().hex().length(24).required(),
    }).required(),
    questions: Joi.array()
        .items(
            Joi.object({
                title: Joi.string().required(),
                options: Joi.when("typeQue", {
                    is: "MCQ",
                    then: Joi.array().items(Joi.string()).length(4).required(),
                    otherwise: Joi.array().length(0).required(),
                }),
                correctAnswer: Joi.string().required(),
                difficulty: Joi.string().valid("Easy", "Normal", "Hard", "Manual").required(),
                cognitiveLevel: Joi.string().valid("Memorization", "Creativity", "Thinking", "Manual").required(),
                typeQue: Joi.string().valid("MCQ", "TF").required(),
            })
        )
        .min(1)
        .required(),
});

export const publishAIExamValidation = Joi.object({
    examId: Joi.string().required(),
    examDetails: Joi.object({
        title: Joi.string().required(),
        openingAt: Joi.number().required(),
        closingAt: Joi.number().greater(Joi.ref("openingAt")).required(),
        durationMinutes: Joi.number().min(1).required(),
        accessCode: Joi.string().optional().allow(""),
        status: Joi.string().valid("Active", "Closed", "Hidden").required(),
        teacherID: Joi.string().hex().length(24).required(),
        deletion_at: Joi.any().optional(),
    }).required(),
});

export const QuestionSchema = z.object({
    q_id: z.string(),
    type: z.enum(["MCQ", "TF"]),
    questionText: z.string().min(5),
    options: z.array(z.string()),
    correctAnswer: z.string(),
    difficulty: z.enum(["Easy", "Normal", "Hard", "Manual"]),
    measures: z.enum(["Memorization", "Creativity", "Thinking", "Manual"]),
    ai_explanation: z.string().min(10),
});

export const ExamSchema = z.object({
    questions: z.array(QuestionSchema).min(1),
});
