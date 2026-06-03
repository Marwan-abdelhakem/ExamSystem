import mongoose, { Schema } from "mongoose";

const RefreshTokenSchema = new Schema(
    {
        token: {
            type: String,
            required: true,
            unique: true,
        },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        expiresAt: {
            type: Date,
            required: true,
        },
        // auto-delete document when expiresAt is reached (MongoDB TTL index)
        createdAt: {
            type: Date,
            default: Date.now,
            expires: 60 * 60 * 24 * 7, // 7 days in seconds
        },
    },
    { timestamps: true }
);

const RefreshTokenModel =
    mongoose.models.RefreshToken ||
    mongoose.model("RefreshToken", RefreshTokenSchema);

export default RefreshTokenModel;
