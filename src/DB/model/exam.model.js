import mongoose, { Schema } from "mongoose"

const ExamSchema = new Schema(
    {
        title: {
            type: String,
            required: true
        },
        openingAt: {
            type: Number,
            required: true
        },
        closingAt: {
            type: Number,
            required: true
        },
        durationMinutes: {
            type: Number,
            required: true
        },
        status: {
            type: String,
            enum: ["Active", "Closed", "Hidden"]
        },
        numOfQuestion: {
            type: Number,
            required: true,
        },
        // cognitiveLevels: {
        //     remember: { type: Number, default: 0, required: true },
        //     understand: { type: Number, default: 0, required: true },
        //     think: { type: Number, default: 0, required: true }
        // },
        // difficultyLevels: {
        //     easy: { type: Number, default: 0, required: true },
        //     medium: { type: Number, default: 0, required: true },
        //     hard: { type: Number, default: 0, required: true }
        // },
        teacherID: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        groupID: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Group",
            required: true,
        },
    },
    {
        timestamps: true
    }
)

const ExamModel = mongoose.models.Exam || mongoose.model("Exam", ExamSchema)

export default ExamModel