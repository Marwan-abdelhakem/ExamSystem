import joi from "joi";

export const contentSchema = {
  body: joi.object({
    content: joi.string().required(),
    groupId: joi.string().required(),
  }),
};

export const getMessagesByGroupIdSchema = {
  params: joi.object({
    groupId: joi.string().required(),
  }),
};
