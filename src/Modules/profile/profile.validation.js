import Joi from "joi";

// GET profile — no body needed

// PUT /api/profile/update-info
export const updateInfoValidation = Joi.object({
    name: Joi.string().min(3).max(20).optional(),
    email: Joi.string().email().optional(),
    educational_level: Joi.string().optional(),
    subjects_taught: Joi.string().optional(),
});

// PUT /api/profile/change-password
export const changePasswordValidation = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required(),
    confirmNewPassword: Joi.string().valid(Joi.ref("newPassword")).required()
        .messages({ "any.only": "Passwords do not match" }),
});

// PUT /api/profile/preferences
export const preferencesValidation = Joi.object({
    emailNotifications: Joi.boolean().optional(),
    aiInsights: Joi.boolean().optional(),
});
