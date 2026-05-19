import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["Student", "Teacher"],
      required: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      minlength: [3, "Name must be at least 3 characters long"],
      maxlength: [20, "Name must be at most 20 characters long"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    qualification: String, // teachers
    subjects_taught: String, // teachers
    educational_level: String, // students

    otp: {
      code: {
        type: String,
        default: null,
      },
      expiry_date: {
        type: Date,
        default: null,
      },
      last_sent_at: {
        type: Date,
        default: null,
      },
      attempts: {
        type: Number,
        default: 0,
      },
      verified: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
  },
);

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema);

export default UserModel;
