import Group from "../../DB/model/group.model.js";
import UserModel from "../../DB/model/user.model.js";
import ExamModel from "../../DB/model/exam.model.js";
import ExamAttemptModel from "../../DB/model/examAttempt.model.js";
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
  const { requestId, action, groupId } = req.body;
  const query = { pendingStudents: requestId };
  if (groupId) {
    query._id = groupId;
  }
  const group = await Group.findOne(query);
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
  const {requestId, groupId} = req.body;
  const query = {rejectedStudents:requestId};
  if (groupId) {
    query._id = groupId;
  }
  const group = await Group.findOne(query);
  if (!group) {
    return next(new Error("Group Not Found"));
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
  if (group.students.includes(requestId)) {
    return next(new Error("Student Is Already A Member In This Group"));
  }
  if (group.pendingStudents.includes(requestId)) {
    group.pendingStudents = group.pendingStudents.filter((id) => id.toString() !== requestId.toString());
  }
  if (group.rejectedStudents.includes(requestId)) {
    group.rejectedStudents = group.rejectedStudents.filter((id) => id.toString() !== requestId.toString());
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
    const userId = req.user.id || req.user._id;
    const userRole = req.user.role;
    const nowInSeconds = Math.floor(Date.now() / 1000);

    if (userRole === "Student") {
      const group = await Group.findOne({
        _id: groupId,
        students: userId,
      }).populate("teacher", "name email avatar");

      if (!group) {
        return res.status(404).json({
          message: "Group not found or unauthorized",
        });
      }

      // Fetch active/closed exams assigned to this group
      const exams = await ExamModel.find({
        groupID: groupId,
        status: { $in: ["Active", "Closed"] },
      });

      const pendingExamsCount = exams.filter(
        (exam) => exam.closingAt > nowInSeconds
      ).length;

      const completedAttempts = await ExamAttemptModel.find({
        studentID: userId,
        examID: { $in: exams.map((e) => e._id) },
        endTime: { $exists: true, $ne: null },
      }).select("examID _id");

      const completedExamAttemptsMap = {};
      completedAttempts.forEach((attempt) => {
        completedExamAttemptsMap[attempt.examID.toString()] = attempt._id.toString();
      });

      const assignedExams = exams.map((exam) => {
        const secondsLeft = exam.closingAt - nowInSeconds;
        const daysLeft = Math.ceil(secondsLeft / (60 * 60 * 24));
        let dueLabel = "";
        if (daysLeft <= 0) dueLabel = "Due today";
        else if (daysLeft === 1) dueLabel = "Due tomorrow";
        else dueLabel = `Due in ${daysLeft} days`;

        const isCompleted = exam._id.toString() in completedExamAttemptsMap;
        const attemptId = completedExamAttemptsMap[exam._id.toString()] || null;
        const isExpired = exam.closingAt <= nowInSeconds;

        return {
          id: exam._id,
          title: exam.title,
          dueDate: new Date(exam.closingAt * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          status: exam.status === "Closed" || isExpired ? "Closed" : (isCompleted ? "Completed" : "Active"),
          dueLabel,
          isCompleted,
          attemptId,
          isAvailable: exam.openingAt <= nowInSeconds && exam.status !== "Closed",
          durationMinutes: exam.durationMinutes,
          numOfQuestion: exam.numOfQuestion,
        };
      });

      return successResponse({
        res,
        message: "Group details fetched successfully",
        data: {
          _id: group._id,
          groupName: group.groupName,
          subject: group.subject,
          inviteCode: group.accessCode,
          teacher: {
            name: group.teacher?.name || "Teacher",
            email: group.teacher?.email || "",
            avatar: group.teacher?.avatar || "",
          },
          pendingExamsCount,
          assignedExams,
        },
      });
    }

    const teacherId = req.user.id;
    const group = await Group.findOne({
      _id: groupId,
      teacher: teacherId,
    }).populate("students", "name email avatar createdAt").populate("pendingStudents", "name email avatar createdAt");

    if (!group) {
      return res.status(404).json({
        message: "Group not found",
      });
    }

    // Fetch exams assigned to this group
    const exams = await ExamModel.find({ groupID: groupId });
    const studentIds = group.students.map((s) => s._id);

    const assignedExams = await Promise.all(
      exams.map(async (exam) => {
        const submissionsCount = await ExamAttemptModel.countDocuments({
          examID: exam._id,
          studentID: { $in: studentIds },
          endTime: { $exists: true, $ne: null }
        });

        return {
          id: exam._id,
          title: exam.title,
          dueDate: new Date(exam.closingAt * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          status: exam.status,
          submissions: submissionsCount,
          totalStudents: studentIds.length,
        };
      })
    );

    // Calculate group statistics
    const attempts = await ExamAttemptModel.find({
      examID: { $in: exams.map((e) => e._id) },
      studentID: { $in: studentIds },
      endTime: { $exists: true, $ne: null }
    });

    let avgPerformance = 0;
    if (attempts.length > 0) {
      let totalScorePercentageSum = 0;
      for (const attempt of attempts) {
        const exam = exams.find((e) => e._id.toString() === attempt.examID.toString());
        const maxScore = exam ? exam.numOfQuestion : 10;
        const scorePercentage = (attempt.totalScore / (maxScore || 10)) * 100;
        totalScorePercentageSum += scorePercentage;
      }
      avgPerformance = Math.round(totalScorePercentageSum / attempts.length);
    }

    const totalPossibleSubmissions = studentIds.length * exams.length;
    const totalSubmissions = attempts.length;
    const completionRate = totalPossibleSubmissions > 0
      ? Math.round((totalSubmissions / totalPossibleSubmissions) * 100)
      : 0;
    const pendingSubmissions = totalPossibleSubmissions - totalSubmissions;

    // Calculate dynamic AI recommendations count
    let aiRecommendationsCount = 0;
    if (group.pendingStudents && group.pendingStudents.length > 0) {
      aiRecommendationsCount += group.pendingStudents.length;
    }
    if (exams.length > 0 && attempts.length > 0) {
      exams.forEach((exam) => {
        const examAttempts = attempts.filter((a) => a.examID.toString() === exam._id.toString());
        if (examAttempts.length > 0) {
          const totalScorePercent = examAttempts.reduce((sum, attempt) => {
            const maxScore = exam.numOfQuestion || 10;
            return sum + (attempt.totalScore / maxScore) * 100;
          }, 0);
          const avgScore = totalScorePercent / examAttempts.length;
          if (avgScore < 60) {
            aiRecommendationsCount += 1;
          }
        }
      });
    }
    if (studentIds.length > 0 && attempts.length > 0) {
      studentIds.forEach((studentId) => {
        const studentAttempts = attempts.filter((a) => a.studentID.toString() === studentId.toString());
        if (studentAttempts.length > 0) {
          const totalScorePercent = studentAttempts.reduce((sum, attempt) => {
            const exam = exams.find((e) => e._id.toString() === attempt.examID.toString());
            const maxScore = exam ? exam.numOfQuestion : 10;
            return sum + (attempt.totalScore / (maxScore || 10)) * 100;
          }, 0);
          const avgScore = totalScorePercent / studentAttempts.length;
          if (avgScore < 60) {
            aiRecommendationsCount += 1;
          }
        }
      });
    }
    exams.forEach((exam) => {
      const isClosingSoon = exam.closingAt - nowInSeconds > 0 && exam.closingAt - nowInSeconds < 2 * 24 * 60 * 60;
      if (isClosingSoon) {
        const examSubmissions = attempts.filter((a) => a.examID.toString() === exam._id.toString()).length;
        if (examSubmissions < studentIds.length) {
          aiRecommendationsCount += 1;
        }
      }
    });

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
        assignedExams,
        performance: {
          avgPerformance,
          completionRate,
          pendingSubmissions: pendingSubmissions > 0 ? pendingSubmissions : 0,
          aiRecommendationsCount,
        }
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

export const deleteGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const teacherId = req.user.id;

    const group = await Group.findOneAndDelete({ _id: groupId, teacher: teacherId });
    if (!group) return next(new Error("Group Not Found"));

    return successResponse({
      res,
      message: "Group Deleted Successfully",
      data: group,
    });
  } catch (error) {
    next(error);
  }
};

export const updateGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { groupName, subject } = req.body;
    const teacherId = req.user.id;

    const group = await Group.findOne({ _id: groupId, teacher: teacherId });
    if (!group) return next(new Error("Group Not Found"));

    if (groupName) group.groupName = groupName;
    if (subject) group.subject = subject;

    await group.save();

    return successResponse({
      res,
      message: "Group Updated Successfully",
      data: group,
    });
  } catch (error) {
    next(error);
  }
};