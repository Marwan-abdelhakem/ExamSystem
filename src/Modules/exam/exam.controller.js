import express from "express";
import { fileUpload } from "../../Utlis/multer.utlis.js";
import { validation } from "../../Middelwares/validation.middelwares.js";
import { authentication } from "../../Middelwares/auth.middlewares.js"; // الـ Auth متاح عندك بالفعل
import { checkExamLimits } from "../../Middelwares/examLimits.middleware.js"; // 💡 استدعاء الـ Middleware الجديد
import {
  generateExamValidation,
  generateExamManuallyValidation,
  publishAIExamValidation,
} from "./exam.validation.js";
import {
  generateExam,
  uploadPDF,
  generateExamManually,
  publishAIExam,
  getMyExams,
} from "./exam.service.js";

const router = express.Router();


router.post("/upload", fileUpload().single("pdfFile"), uploadPDF);
router.post(
  "/generate",
  authentication,
  validation(generateExamValidation),
  checkExamLimits,
  generateExam,
);

router.post(
  "/generate-manually",
  authentication,
  validation(generateExamManuallyValidation),
  generateExamManually,
);
router.post(
  "/publish-ai",
  authentication,
  validation(publishAIExamValidation),
  publishAIExam,
);
router.get("/myExams", authentication, getMyExams);

export default router;
