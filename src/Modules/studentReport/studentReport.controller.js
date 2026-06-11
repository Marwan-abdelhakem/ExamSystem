import express from "express";
import * as studentReportService from "./studentReport.service.js";
import { authentication, authorization } from "../../Middelwares/auth.middlewares.js";

const router = express.Router();

router.use(authentication);
router.use(authorization({ role: ["Student"] }));

// GET /api/student-report
router.get("/", studentReportService.getStudentReport);

export default router;
