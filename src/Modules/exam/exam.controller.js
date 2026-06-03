import express from "express";
import { fileUpload } from "../../Utlis/multer.utlis.js";
import { validation } from "../../Middelwares/validation.middelwares.js";
import { generateExamValidation, generateExamManuallyValidation, publishAIExamValidation } from "./exam.validation.js";
import { generateExam, uploadPDF, generateExamManually, publishAIExam } from "./exam.service.js";

const router = express.Router();

router.post("/upload", fileUpload().single("pdfFile"), uploadPDF);
router.post("/generate", validation(generateExamValidation), generateExam);
router.post("/generate-manually", validation(generateExamManuallyValidation), generateExamManually);
router.post("/publish-ai", validation(publishAIExamValidation), publishAIExam);

export default router;
