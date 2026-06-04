import express from "express";
import * as authService from "./auth.service.js";
import { validation } from "../../Middelwares/validation.middelwares.js";
import { fileUpload } from "../../Utlis/multer.utlis.js";
import { authentication } from "../../Middelwares/auth.middlewares.js";
import { signUpValidation, loginValidation, sendOtpSchema, verifyOtpSchema, resetPasswordSchema, changePasswordSchema } from "./auth.validation.js";

const router = express.Router();

router.post("/signUp", fileUpload().single("file"), validation(signUpValidation), authService.signUp);
router.post("/login", validation(loginValidation), authService.login);
router.post("/send-otp", validation(sendOtpSchema), authService.sendOtp);
router.post("/verify-otp", validation(verifyOtpSchema), authService.verifyOtp);
router.post("/reset-password", validation(resetPasswordSchema), authService.resetPassword);
router.post("/refresh-token", authService.refreshToken);
router.post("/logout", authService.logout);
router.get("/me", authentication, authService.getMe);
router.put("/change-password", authentication, validation(changePasswordSchema), authService.changePassword);
router.put("/profile", authentication, fileUpload().single("avatar"), authService.updateProfile);

export default router;