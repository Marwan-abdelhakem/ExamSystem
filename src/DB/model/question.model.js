import mongoose, { Schema } from "mongoose"

const QuestionSchema = new Schema(
    {
        title: {
            type: String,
            required: true
        },
        options: {
            type: [String],
            required: true
        },
        correctAnswer: {
            type: String,
            required: true
        },
        difficulty: {
            type: String,
            enum: ["Easy", "Normal", "Hard", "Manual"],
            required: true
        },
        cognitiveLevel: {
            type: String,
            enum: ["Memorization", "Creativity", "Thinking", "Manual"],
            required: true
        },
        examID: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Exam",
            required: true
        },
        typeQue: {
            type: String,
            enum: ["MCQ", "TF"]
        },
        ai_explanation: {
            type: String,
            default: null,
        }
    },
    {
        timestamps: true
    }
)

const QuestionModel = mongoose.models.Question || mongoose.model("Question", QuestionSchema)

export default QuestionModel