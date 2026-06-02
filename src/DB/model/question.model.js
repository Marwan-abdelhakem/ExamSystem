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
            enum: ['easy', 'medium', 'hard'],
            required: true
        },
        cognitiveLevel: {
            type: String,
            enum: ['remember', 'understand', 'think'],
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
        }
    },
    {
        timestamps: true
    }
)

const QuestionModel = mongoose.models.Question || mongoose.model("Question", QuestionSchema)

export default QuestionModel