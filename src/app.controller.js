import cookieParser from "cookie-parser"
import connectDb from "./DB/connectDB.js"
import globalErrorHandler from "./Utlis/errorHandler.utlis.js"
import authRouter from "./Modules/auth/auth.controller.js"
import groupRouter from "./Modules/groups/group.controller.js"
import studentsRouter from "./Modules/students/student.controller.js"
import examRouter from "./Modules/exam/exam.controller.js"
import questionRouter from "./Modules/question/question.controller.js"
import dashboardRouter from "./Modules/dashboard/dashboard.controller.js"
import examSessionRouter from "./Modules/examSession/examSession.controller.js"
import studentReportRouter from "./Modules/studentReport/studentReport.controller.js"
import profileRouter from "./Modules/profile/profile.controller.js"
import studentDashboardRouter from "./Modules/studentDashboard/studentDashboard.controller.js"
import paymentWebhook from "./Modules/payment/payment.webhook.js"
import paymentRouter from "./Modules/payment/payment.controller.js"
import cors from "cors"


const allowedOrigins = [
    "http://localhost:5173", 
    "http://localhost:5172", 
    "http://localhost:3000",
    "https://exam.tawseela-sina.com",
    "https://acdemix.tawseela-sina.com"
];

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
    app.use("/webhook", paymentWebhook);
    app.use(express.json())
    await connectDb()
    app.use(cookieParser());
    app.use(cors(corsOptions));

    app.use("/api/auth", authRouter)
    app.use("/api/group", groupRouter)
    app.use("/api/students", studentsRouter)
    app.use("/api/exam", examRouter)
    app.use("/api/question", questionRouter)
    app.use("/api/dashboard", dashboardRouter)
    app.use("/api/exam-session", examSessionRouter)
    app.use("/api/student-report", studentReportRouter)
    app.use("/api/profile", profileRouter)
    app.use("/api/student-dashboard", studentDashboardRouter)
    app.use("/api/payments", paymentRouter)

    app.get("/", (req, res) => {
        return res.status(200).json({
            message: "Welcome to Acdemix Exam System API",
            status: "Running"
        });
    });

    app.use((req, res, next) => {
    return next(new Error("Not found Handler !!!!", { cause: 404 }))
})

    app.use(globalErrorHandler)
}

export default bootStrap