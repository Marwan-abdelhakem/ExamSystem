import express from "express";
import * as profileService from "./profile.service.js";
import { validation } from "../../Middelwares/validation.middelwares.js";
import { authentication } from "../../Middelwares/auth.middlewares.js";
import { fileUpload } from "../../Utlis/multer.utlis.js";
import {
    updateInfoValidation,
    changePasswordValidation,
    preferencesValidation,
} from "./profile.validation.js";

const router = express.Router();

router.use(authentication);

// GET /api/profile
router.get("/", profileService.getProfile);

// PUT /api/profile/update-photo
router.put("/update-photo", fileUpload().single("avatar"), profileService.updatePhoto);

// PUT /api/profile/update-info
router.put("/update-info", validation(updateInfoValidation), profileService.updateInfo);

// PUT /api/profile/change-password
router.put("/change-password", validation(changePasswordValidation), profileService.changePassword);

// PUT /api/profile/preferences
router.put("/preferences", validation(preferencesValidation), profileService.updatePreferences);

// DELETE /api/profile/deactivate  delete account
router.delete("/deactivate", profileService.deactivateAccount);

export default router;
