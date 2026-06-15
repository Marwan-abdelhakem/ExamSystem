import mongoose, { Schema } from "mongoose"

const ExamSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
    },
    openingAt: {
      type: Number,
      required: true,
    },
    closingAt: {
      type: Number,
      required: true,
    },
    durationMinutes: {
      type: Number,
      required: true,
    },
    deletion_at: { type: Date, expires: 0 },
    status: {
      type: String,
      enum: ["Active", "Closed", "Hidden", "Suspended"],
      default: "Active",
    },
    numOfQuestion: {
      type: Number,
      required: true,
    },
    teacherID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    groupID: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    }],
    parentExamID: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
    },
    allowReview: {
      type: Boolean,
      default: true,
    },
    randomizeQuestions: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

const ExamModel = mongoose.models.Exam || mongoose.model("Exam", ExamSchema)

export default ExamModel