import express from "express";
import * as questionService from "./question.service.js";
import { validation } from "../../Middelwares/validation.middelwares.js";
import {
  deleteQuestionValidation,
  validateUpdateQuestion,
} from "./question.validation.js";

const router = express.Router();

router.get("/questions/:examId", questionService.getQuestionsByExamId);
router.delete(
  "/delete-question",
  validation(deleteQuestionValidation),
  questionService.deleteQuestion,
);
router.put(
  "/update-question",
  validation(validateUpdateQuestion),
  questionService.upDateQuestion,
);

export default router;
