import express from "express";
import { fileUpload } from "../../Utlis/multer.utlis.js";
import { validation } from "../../Middelwares/validation.middelwares.js";
import { authentication } from "../../Middelwares/auth.middlewares.js"; 
import { checkExamLimits } from "../../Middelwares/examLimits.middleware.js";
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
import { checkPlanUploadLimits } from "../../Middelwares/checkPlanUploadLimits.middleware.js";

const router = express.Router();


router.post("/upload", fileUpload().single("pdfFile"), uploadPDF);
router.post(
  "/generate",
  authentication,
  validation(generateExamValidation),
   checkPlanUploadLimits,
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
