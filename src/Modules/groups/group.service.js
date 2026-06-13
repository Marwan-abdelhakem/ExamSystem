import Group from "../../DB/model/group.model.js";
import UserModel from "../../DB/model/user.model.js";
import { RandomString } from "../../Utlis/generateOtp.js";
import successResponse from "../../Utlis/successRespone.utlis.js";

export const createGroup = async (req, res, next) => {
  const { groupName, subject } = req.body;

  const teacher = req.user.id;

  if (!groupName || !subject) {
    return next(new Error("Please Fill All The Fields"));
  }
  const exists = await Group.findOne({ groupName, teacher });

  if (exists) {
    return next(new Error("Group Already Exists"));
  }

  const accessCode = RandomString(8);

  const group = await Group.create({
    groupName,
    subject,
    accessCode,
    teacher,
  });

  return successResponse({
    res,
    message: "Group Created Successfully",
    data: group,
  });
};

export const joinGroup = async (req, res, next) => {
  const { accessCode } = req.body;

  const userId = req.user.id;

  const group = await Group.findOne({ accessCode });

  if (!group) {
    return next(new Error("Group Not Found"));
  }

  const rejected = group.rejectedStudents.includes(userId);
  if (rejected) {
    return next(new Error("You Are Rejected From This Group"));
  }

  const pending = group.pendingStudents.includes(userId);
  if (pending) {
    return next(new Error("You Are Already A Pending Member"));
  }

  const alreadyJoined = group.students.includes(userId);
  if (alreadyJoined) {
    return next(new Error("You Are Already A Member"));
  }

  const pendingAnotherGroup = await Group.findOne({
    pendingStudents: userId,
  });

  if (pendingAnotherGroup) {
    return next(new Error("You Are Already A Pending Member In Another Group"));
  }

  const alreadyInAnotherGroup = await Group.findOne({
    students: userId,
  });

  if (alreadyInAnotherGroup) {
    return next(new Error("You Are Already A Student In Another Group"));
  }

  group.pendingStudents.push(userId);

  await group.save();

  return successResponse({
    res,
    message: "Group Join Request Sent",
    data: group,
  });
};

//  edited to include rejectedAt and requestedAt fields and group details in the response
export const teacherViewPendingRequest = async (req, res, next) => {
  const teacher = req.user.id;
  const groups = await Group.find({ teacher }).populate("pendingStudents");
  if (!groups) {
    return next(new Error("No Groups Found"));
  }

  const pendingStudents = groups.flatMap((group) =>
    group.pendingStudents.map((student) => ({
      studentId: student,
      groupId: {
        _id: group._id,
        groupName: group.groupName,
        subject: group.subject,
      },
      requestedAt: group.updatedAt,
    })),
  );

  return successResponse({
    res,
    message: "Pending Requests",
    data: pendingStudents,
  });
};

export const teacherViewRejectedRequest = async (req, res, next) => {
  const teacher = req.user.id;
  const groups = await Group.find({ teacher }).populate("rejectedStudents");
  if (!groups) {
    return next(new Error("No Groups Found"));
  }

  const rejectedStudents = groups.flatMap((group) =>
    group.rejectedStudents.map((student) => ({
      studentId: student,
      groupId: {
        _id: group._id,
        groupName: group.groupName,
        subject: group.subject,
      },
      rejectedAt: group.updatedAt,
    })),
  );

  return successResponse({
    res,
    message: "Rejected Requests",
    data: rejectedStudents,
  });
};

export const teacherAcceptRejectRequest = async (req, res, next) => {
  const { requestId, action } = req.body;
  const group = await Group.findOne({ pendingStudents: requestId });
  if (!group) {
    return next(new Error("Group Not Found"));
  }
  if (action === "accept") {
    group.students.push(requestId);
    group.pendingStudents = group.pendingStudents.filter(
      (id) => id.toString() !== requestId.toString(),
    );
  
  } else {
    group.rejectedStudents.push(requestId);
    group.pendingStudents = group.pendingStudents.filter(
      (id) => id.toString() !== requestId.toString(),
    );
  }
  await group.save();
  return successResponse({
    res,
    message: "Request Processed",
    data: group,
  });
};

export  const acceptrejectedStudents = async (req, res, next) => {
  const {requestId} = req.body;
  const group = await Group.findOne({rejectedStudents:requestId});
  if (!group) {
    return next(new Error("Group Not Found"));
  }
  const alreadyInAnotherGroup = await Group.findOne({
    students: requestId,
  });

  if (alreadyInAnotherGroup) {
    return next(new Error("You Are Already A Student In Another Group"));
  }
  group.students.push(requestId);
  group.rejectedStudents = group.rejectedStudents.filter(
    (id) => id.toString() !== requestId.toString(),
  );
  await group.save();
  return successResponse({
    res,
    message: "Request Accepted",
    data: group,
  });
};

export const  addStudentToGroup = async (req, res, next) => {
  const {groupId,requestId} = req.body;
  const group = await Group.findById(groupId);
  if (!group) {
    return next(new Error("Group Not Found"));
  }
  const alreadyInAnotherGroup = await Group.findOne({
    students: requestId,
  });
  if (group.pendingStudents.includes(requestId)) {
    group.pendingStudents = group.pendingStudents.filter((id) => id.toString() !== requestId.toString());
  }
  if (group.rejectedStudents.includes(requestId)) {
    group.rejectedStudents = group.rejectedStudents.filter((id) => id.toString() !== requestId.toString());
  }
  if (alreadyInAnotherGroup) {
    return next(new Error("You Are Already A Student In Another Group"));
  }

  const alreadyInAnotherGroupPending = await Group.findOne({
    pendingStudents: requestId,
  });

  if (alreadyInAnotherGroupPending) {
    return next(new Error("You Are Already A Pending Student In Another Group"));
  }
  group.students.push(requestId);
  await group.save();
  return successResponse({
    res,
    message: "Request Accepted",
    data: group,
  });
};

export const getMyGroups = async (req, res, next) => {
  const userId = req.user.id || req.user._id;
  const userRole = req.user.role;

  let groups;
  if (userRole === "Student") {
    groups = await Group.find({ students: userId });
  } else {
    groups = await Group.find({ teacher: userId });
  }
  
  return successResponse({
    res,
    message: "Groups fetched successfully",
    data: groups,
  });
};



export const getGroupDetails = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const teacherId = req.user.id;

    const group = await Group.findOne({
      _id: groupId,
      teacher: teacherId,
    });

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    return successResponse({
      res,
      message: "Group details fetched successfully",
      data: {
        _id: group._id,
        groupName: group.groupName,
        subject: group.subject,
        inviteCode: group.accessCode,
        students: group.students,
        pendingStudents: group.pendingStudents,
        totalStudents: group.students.length,
      },
    });
  } catch (error) {      
    next(error);
  }
};                      
export const removeStudentFromGroup = async (req, res, next) => {
  try {                   
    const { groupId, studentId } = req.params;
    const teacherId = req.user.id;

    const group = await Group.findOne({ _id: groupId, teacher: teacherId });
    if (!group) return next(new Error("Group Not Found"));

    const isStudent = group.students.some(
      (id) => id.toString() === studentId.toString()
    );
    if (!isStudent) return next(new Error("Student Not Found In This Group"));

    group.students = group.students.filter(
      (id) => id.toString() !== studentId.toString()
    );
    await group.save();

    return successResponse({
      res,
      message: "Student Removed Successfully",
      data: group,
    });
  } catch (error) {
    next(error);
  }
};

export const addStudentToGroupDetail = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { email } = req.body;
    const teacherId = req.user.id;

    if (!email) {
      return next(new Error("Email is required", { cause: 400 }));
    }

    const student = await UserModel.findOne({ email, role: "Student" });
    if (!student) {
      return next(new Error("Student not found", { cause: 404 }));
    }

    const group = await Group.findOne({ _id: groupId, teacher: teacherId });
    if (!group) {
      return next(new Error("Group not found or unauthorized", { cause: 404 }));
    }

    const studentIdStr = student._id.toString();

    // Check if student is already in the group
    if (group.students.some((id) => id.toString() === studentIdStr)) {
      return next(new Error("Student already in this group", { cause: 400 }));
    }

    // Remove from pending/rejected if they are there
    group.pendingStudents = group.pendingStudents.filter((id) => id.toString() !== studentIdStr);
    group.rejectedStudents = group.rejectedStudents.filter((id) => id.toString() !== studentIdStr);

    group.students.push(student._id);
    await group.save();

    return successResponse({
      res,
      message: "Student added successfully",
      data: {
        addedStudent: {
          name: student.name,
          email: student.email,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};