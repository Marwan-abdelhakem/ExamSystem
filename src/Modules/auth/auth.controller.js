import express from "express";
import * as authService from "./auth.service.js";
import { validation } from "../../Middelwares/validation.middelwares.js";
import { fileUpload } from "../../Utlis/multer.utlis.js";
import { signUpValidation, loginValidation, sendOtpSchema, verifyOtpSchema, resetPasswordSchema } from "./auth.validation.js";

const router = express.Router();

router.post("/signUp", fileUpload().single("file"), validation(signUpValidation), authService.signUp);
router.post("/login", validation(loginValidation), authService.login);
router.post("/send-otp", validation(sendOtpSchema), authService.sendOtp);
router.post("/verify-otp", validation(verifyOtpSchema), authService.verifyOtp);
router.post("/reset-password", validation(resetPasswordSchema), authService.resetPassword);
export default router;