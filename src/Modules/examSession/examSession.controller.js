import express from "express";
import * as examSessionService from "./examSession.service.js";
import { validation } from "../../Middelwares/validation.middelwares.js";
import { authentication, authorization } from "../../Middelwares/auth.middlewares.js";
import { startExamValidation, submitExamValidation } from "./examSession.validation.js";

const router = express.Router();

router.use(authentication);
router.use(authorization({ role: ["Student", "Teacher"] }));

// POST /api/exam-session/start
router.post("/start", validation(startExamValidation), examSessionService.startExam);

// POST /api/exam-session/submit
router.post("/submit", validation(submitExamValidation), examSessionService.submitExam);

// GET /api/exam-session/result/:attemptId
router.get("/result/:attemptId", examSessionService.getAttemptResult);

export default router;
