import mongoose, { Schema } from "mongoose";

const GroupSchema = new Schema(
  {
    groupName: {
      type: String,
      required: true,
    },

    subject: {
      type: String,
      required: true,
    },

    accessCode: {
      type: String,
      required: true,
      unique: true,
    },

    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    students: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    pendingStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    rejectedStudents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  {
    timestamps: true,
  },
);

const GroupModel =
  mongoose.models.Group || mongoose.model("Group", GroupSchema);

export default GroupModel;
