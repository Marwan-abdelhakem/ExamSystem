import mongoose, { Schema } from "mongoose"

const UserSchema = new Schema(
    {

    },
    {
        timestamps: true
    }
)

const UserModel = mongoose.models.User || mongoose.model("User", UserSchema)

export default UserModel