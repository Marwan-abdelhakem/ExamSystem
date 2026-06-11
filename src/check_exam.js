import mongoose from "mongoose";
import dotenv from "dotenv";
import QuestionModel from "./DB/model/question.model.js";
import ExamModel from "./DB/model/exam.model.js";

// Load configuration
const envPath = "./src/config/.env";
dotenv.config({ path: envPath });

const mongoUrl = process.env.MONGO_URL || "mongodb://mamer3707_db_user:Xkq7uUnpMIJGpnFP@ac-tzaty4c-shard-00-00.qd2kkic.mongodb.net:27017,ac-tzaty4c-shard-00-01.qd2kkic.mongodb.net:27017,ac-tzaty4c-shard-00-02.qd2kkic.mongodb.net:27017/test?ssl=true&replicaSet=atlas-12286m-shard-0&authSource=admin&appName=Cluster0";

console.log("Connecting to:", mongoUrl);
await mongoose.connect(mongoUrl);
console.log("Connected!");

const examId = "6a2abdc5469108940bda887f";

const exam = await ExamModel.findById(examId);
console.log("Exam details:", exam ? JSON.stringify(exam, null, 2) : "NOT FOUND");

if (exam) {
  const targetId = exam.parentExamID || examId;
  console.log("Target Exam ID for questions:", targetId, "Type of targetId:", typeof targetId);

  // 1. Query using direct string with QuestionModel
  const questions = await QuestionModel.find({ examID: targetId }).select(
    "title options typeQue difficulty cognitiveLevel"
  );
  console.log("Questions count using QuestionModel with targetId string/ObjectId:", questions.length);

  // 2. Query using explicit ObjectId casting
  const questionsCast = await QuestionModel.find({ examID: new mongoose.Types.ObjectId(targetId) }).select(
    "title options typeQue difficulty cognitiveLevel"
  );
  console.log("Questions count using QuestionModel with explicit Types.ObjectId casting:", questionsCast.length);
}

await mongoose.disconnect();
