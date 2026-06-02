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



export const QuestionSchema = z.object({
    q_id: z.string(),
    type: z.enum(["MCQ", "TF"]),
    questionText: z.string(),
    options: z.array(z.string()).optional(),
    correctAnswer: z.string(),
    difficulty: z.enum(["Easy", "Normal", "Hard"]),
    measures: z.enum(["Memorization", "Creativity", "Thinking"]),
    ai_explanation: z.string(),
});

export const ExamSchema = z.object({
    questions: z.array(QuestionSchema).min(1),
});
