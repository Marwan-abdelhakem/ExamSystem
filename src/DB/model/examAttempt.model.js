import mongoose, { Schema } from "mongoose"

const ExamAttemptSchema = new Schema(
    {
        examID: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Exam",
            required: true
        },
        studentID: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        startTime: {
            type: Date,
            default: Date.now
        },
        endTime: {
            type: Date
        },
        totalScore: {
            type: Number,
            default: 0
        },
        answers: [
            {
                questionId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Question",
                    required: true
                },
                studentAnswer: {
                    type: String,
                    default: null
                },
                isCorrect: {
                    type: Boolean,
                    default: false
                }
            }
        ]
    },
    {
        timestamps: true
    }
)

const ExamAttemptModel = mongoose.models.ExamAttempt || mongoose.model("ExamAttempt", ExamAttemptSchema)

export default ExamAttemptModel