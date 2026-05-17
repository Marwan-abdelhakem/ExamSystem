import mongoose, { Schema } from "mongoose"

const GroupSchema = new Schema(
    {
        groupName: {
            type: String,
            required: true
        },
        subject: {
            type: String,
            required: true
        },
        accessCode: {
            type: String,
            required: true
        },
        teacherID: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        studentId: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
                required: true,
            }
        ]
    },
    {
        timestamps: true
    }
)

const GroupModel = mongoose.models.Group || mongoose.model("Group", GroupSchema)

export default GroupModel