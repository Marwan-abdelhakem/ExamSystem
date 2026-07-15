import ContentModel from "../../DB/model/messages.js";
import successResponse from "../../Utlis/successRespone.utlis.js";
import GroupModel from "../../DB/model/group.model.js";
import { checkGroupMembership } from "../../Utlis/checkGroupMembership.js";

export const createMessage = async (req, res, next) => {
  const { content, groupId } = req.body;
  const senderId = req.user.id;

  const group = await GroupModel.findById(groupId);
  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  if (!checkGroupMembership(group, senderId)) {
    return res
      .status(403)
      .json({ message: "User is not a member of this group" });
  }

  const senderType = req.user.role;

  const message = await ContentModel.create({
    content,
    groupId,
    senderId,
    senderType,
  });
  return successResponse({
    res,
    statusCode: 201,
    message: "Message created successfully",
    data: message,
  });
};

export const getMessagesByGroupId = async (req, res, next) => {
  const senderId = req.user.id;
  const { groupId } = req.params;
  const group = await GroupModel.findById(groupId);
  if (!group) {
    return res.status(404).json({ message: "Group not found" });
  }

  if (!checkGroupMembership(group, senderId)) {
    return res
      .status(403)
      .json({ message: "User is not a member of this group" });
  }

  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const skip = (page - 1) * limit;
  const messages = await ContentModel.find({ groupId })
    .select("-__v")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: "senderId",
      select: "name role avatar",
    })
    .lean();

  return successResponse({
    res,
    statusCode: 200,
    message: "Messages retrieved successfully",
    data: messages,
  });
};
