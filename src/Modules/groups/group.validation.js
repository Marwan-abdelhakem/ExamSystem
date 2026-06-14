import joi from "joi";

export const createGroupValidation = joi.object({
  groupName: joi.string().required().min(2).max(20).trim(),
  subject: joi.string().required().min(2).max(20).trim(),
});

export const joinGroupValidation = joi.object({
  accessCode: joi.string().length(8).required().trim(),
})

export const teacherAcceptRejectRequestValidation = joi.object({
  requestId: joi.string().required(),
  action: joi.string().required().valid("accept","reject"),
  groupId: joi.string().optional(),
})

export const addStudentToGroupValidation = joi.object({
  requestId: joi.string().required(),
  groupId: joi.string().required(),
})

export const acceptRejectedStudentValidation = joi.object({
  requestId: joi.string().required(),
  groupId: joi.string().optional(),
})
