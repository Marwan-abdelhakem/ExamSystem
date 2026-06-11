import express from "express";
import * as dashboardService from "./dashboard.service.js";
import { authentication, authorization } from "../../Middelwares/auth.middlewares.js";

const router = express.Router();

router.use(authentication);
router.use(authorization({ role: ["Teacher"] }));

// GET /api/dashboard
router.get("/", dashboardService.getTeacherDashboard);

export default router;
