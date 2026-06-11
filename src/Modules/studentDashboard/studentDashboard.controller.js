import express from "express";
import * as studentDashboardService from "./studentDashboard.service.js";
import { authentication, authorization } from "../../Middelwares/auth.middlewares.js";

const router = express.Router();

router.use(authentication);
router.use(authorization({ role: ["Student"] }));

// GET /api/student-dashboard
router.get("/", studentDashboardService.getStudentDashboard);

export default router;
