import mongoose, { Schema } from "mongoose"

const UserSchema = new Schema(
    {
        role: {
            type: String,
            enum: ["Student", "Teacher"],
            required: true
        },
        name: {
            type: String,
            requred: true,
            minlength: [3, "Name must be at least 3 characters long"],
            maxlength: [20, "Name must be at most 20 characters long"],
        },
        email: {
            type: String,
            required: true,
            trim: true,
            unique: true
        },
        password: {
            type: String,
            requred: true
        },
        qualification: String,      //Teacher
        subjects_taught: String,    //Teacher
        educational_level: String,  //Student
    },
    {
        timestamps: true
    }
)

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema)

export default UserModel