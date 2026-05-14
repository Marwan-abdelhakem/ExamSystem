import cookieParser from "cookie-parser"
import connectDb from "./DB/connectDB.js"
import globalErrorHandler from "./Utlis/errorHandler.utlis.js"

const bootStrap = async (app, express) => {
    app.use(express.json())
    await connectDb()





    app.use(cookieParser());

    app.all("/*dummy", (req, res, next) => {
        return next(new Error("Not found Handler !!!!", { cause: 409 }))
    })

    app.use(globalErrorHandler)
}

export default bootStrap