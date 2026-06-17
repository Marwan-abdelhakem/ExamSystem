import express from "express";
import { fileUpload } from "../../Utlis/multer.utlis.js";
import { validation } from "../../Middelwares/validation.middelwares.js";
import { authentication } from "../../Middelwares/auth.middlewares.js";
import { checkExamLimits } from "../../Middelwares/examLimits.middleware.js";
import {
  generateExamValidation,
  generateExamManuallyValidation,
  publishAIExamValidation,
  updateExamValidation,
} from "./exam.validation.js";
import {
  generateExam,
  uploadPDF,
  generateExamManually,
  publishAIExam,
  getMyExams,
  downloadExamPDF,
  updateExamStatus,
  toggleKeepForever,
  updateExam,
  deleteExam,
} from "./exam.service.js";
import { checkPlanUploadLimits } from "../../Middelwares/checkPlanUploadLimits.middleware.js";

const router = express.Router();

router.post(
  "/upload",
  authentication,
  fileUpload().single("pdfFile"),
  checkPlanUploadLimits,
  uploadPDF,
);

router.post(
  "/generate",
  authentication,
  checkExamLimits,
  validation(generateExamValidation),
  generateExam,
);

router.post(
  "/generate-manually",
  authentication,
  checkExamLimits,
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
router.patch("/:examId/status", authentication, updateExamStatus);
router.patch("/:examId/toggle-keep-forever", authentication, toggleKeepForever);
router.get("/:examId/download-pdf", authentication, downloadExamPDF);
router.patch("/:examId", authentication, validation(updateExamValidation), updateExam);
router.delete("/:examId", authentication, deleteExam);

export default router;
