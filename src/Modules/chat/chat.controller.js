import express from "express";
import { validation } from "../../Middelwares/validation.middelwares.js";
import { authentication } from "../../Middelwares/auth.middlewares.js";
import {
  contentSchema,
  getMessagesByGroupIdSchema,
} from "./chat.validation.js";
import { createMessage, getMessagesByGroupId } from "./chat.service.js";
const router = express.Router();

router.post(
  "/messages",
  authentication,
  validation(contentSchema),
  createMessage,
);
router.get(
  "/messages/:groupId",
  authentication,
  validation(getMessagesByGroupIdSchema),
  getMessagesByGroupId,
);

export default router;
