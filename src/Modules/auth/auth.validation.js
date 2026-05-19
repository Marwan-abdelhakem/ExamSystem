import Joi from "joi";

export const loginValidation = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

export const signUpValidation = Joi.object({
  role: Joi.string().valid("Student", "Teacher").required(),
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  subjects_taught: Joi.string(),
  educational_level: Joi.string(),
});

export const sendOtpSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.number().max(6).required(),
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.number().max(6).required(),
  password: Joi.string().min(6).required(),
});