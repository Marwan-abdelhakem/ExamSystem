import mongoose from "mongoose"

const connectDb = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URL)
        console.log("Database connect Successfully")
    } catch (error) {
        console.log("Database connection Error", error.message)
    }
}

export default connectDb