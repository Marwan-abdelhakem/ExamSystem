import express from "express";
import * as authService from "./auth.service.js";
import { validation } from "../../Middelwares/validation.middelwares.js";
import { fileUpload } from "../../Utlis/multer.utlis.js";
import { loginValidation } from "./auth.validation.js";

const router = express.Router();

router.post("/signUp", fileUpload().single("files"), authService.signUp)

router.post("/login", validation(loginValidation), authService.login);

export default router;