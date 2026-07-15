import mongoose, { Schema } from "mongoose";

const ContentSchema = new Schema(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    messageType: {
      type: String,
      enum: ["text", "image", "file", "video", "audio"],
      default: "text",
    },

    attachments: [
      {
        url: String,
        publicId: String,
        originalName: String,
        mimeType: String,
        size: Number,
      },
    ],

    isEdited: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

ContentSchema.index({ groupId: 1, createdAt: -1 });

const ContentModel =
  mongoose.models.Content || mongoose.model("Content", ContentSchema);

export default ContentModel;
