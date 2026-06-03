import cookieParser from "cookie-parser"
import connectDb from "./DB/connectDB.js"
import globalErrorHandler from "./Utlis/errorHandler.utlis.js"
import authRouter from "./Modules/auth/auth.controller.js"
import groupRouter from "./Modules/groups/group.controller.js"
import examRouter from "./Modules/exam/exam.controller.js"
import questionRouter from "./Modules/question/question.controller.js"
import cors from "cors"


const allowedOrigins = ["*", "http://localhost:5173"];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
};

const bootStrap = async (app, express) => {
    app.use(express.json())
    await connectDb()
    app.use(cookieParser());
    app.use(cors(corsOptions));

    app.use("/api/auth", authRouter)
    app.use("/api/group", groupRouter)
    app.use("/api/exam", examRouter)
    app.use("/api/question", questionRouter)

    app.all("/*dummy", (req, res, next) => {
        return next(new Error("Not found Handler !!!!", { cause: 409 }))
    })

    app.use(globalErrorHandler)
}

export default bootStrap