import express from "express";
import * as groupService from "./group.service.js";
import { validation } from "../../Middelwares/validation.middelwares.js";
import { authentication } from "../../Middelwares/auth.middlewares.js";
import {
  createGroupValidation,
  joinGroupValidation,
  teacherAcceptRejectRequestValidation,
  acceptRejectedStudentValidation,
  addStudentToGroupValidation,
} from "./group.validation.js";

const router = express.Router();

router.use(authentication);

router.post(
  "/createGroup",
  validation(createGroupValidation),
  groupService.createGroup,
);

router.post(
  "/joinGroup",
  validation(joinGroupValidation),
  groupService.joinGroup,
);
router.get(
  "/teacherViewPendingRequest",
  groupService.teacherViewPendingRequest,
);
router.get(
  "/teacherViewRejectedRequest",
  groupService.teacherViewRejectedRequest,
);
router.post(
  "/teacherAcceptRejectRequest",
  validation(teacherAcceptRejectRequestValidation),
  groupService.teacherAcceptRejectRequest,
);
router.post(
  "/acceptRejectedStudent",
  validation(acceptRejectedStudentValidation),
  groupService.acceptrejectedStudents,
);
router.post(
  "/addStudentToGroup",
  validation(addStudentToGroupValidation),
  groupService.addStudentToGroup,
);

router.get(
  "/myGroups",
  groupService.getMyGroups,
);

// -------------group details----------------
router.get("/:groupId", groupService.getGroupDetails);
router.delete("/:groupId/students/:studentId", groupService.removeStudentFromGroup);
export default router;
