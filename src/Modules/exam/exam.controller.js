import express from "express";
import { fileUpload } from "../../Utlis/multer.utlis.js";
import { validation } from "../../Middelwares/validation.middelwares.js";
import { generateExamValidation, generateExamManuallyValidation } from "./exam.validation.js";
import { generateExam, uploadPDF, generateExamManually } from "./exam.service.js";

const router = express.Router();

router.post("/upload", fileUpload().single("pdfFile"), uploadPDF);
router.post("/generate", validation(generateExamValidation), generateExam);
router.post("/generate-manually", validation(generateExamManuallyValidation), generateExamManually);

export default router;
