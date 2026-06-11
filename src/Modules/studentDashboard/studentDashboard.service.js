import GroupModel from "../../DB/model/group.model.js";
import ExamModel from "../../DB/model/exam.model.js";
import ExamAttemptModel from "../../DB/model/examAttempt.model.js";
import UserModel from "../../DB/model/user.model.js";
import successResponse from "../../Utlis/successRespone.utlis.js";



export const getStudentDashboard = async (req, res, next) => {
    const studentID = req.user._id;
    const nowInSeconds = Math.floor(Date.now() / 1000);

    const groups = await GroupModel.find({ students: studentID }).select("_id subject teacher");

    if (groups.length === 0) {
        return successResponse({
            res,
            statusCode: 200,
            message: "Student dashboard fetched successfully",
            data: {
                studentName: req.user.name,
                stats: {
                    totalExamsAssigned: 0,
                    overallProgress: 0,
                    pointsEarned: req.user.available_credits || 0,
                },
                assignedExams: [],
            },
        });
    }

    const groupIds = groups.map((g) => g._id);

    const allExams = await ExamModel.find({
        groupID: { $in: groupIds },
        status: "Active",
    }).populate({ path: "teacherID", select: "name" })
        .populate({ path: "groupID", select: "subject" });

    const totalExamsAssigned = allExams.length;

    const completedAttempts = await ExamAttemptModel.find({
        studentID,
        endTime: { $exists: true, $ne: null },
    }).select("examID totalScore answers");

    const completedExamIds = new Set(
        completedAttempts.map((a) => a.examID.toString())
    );

    const totalCompleted = completedAttempts.length;
    const overallProgress =
        totalExamsAssigned > 0
            ? Math.round((totalCompleted / totalExamsAssigned) * 100)
            : 0;

    let pointsEarned = 0;
    completedAttempts.forEach((attempt) => {
        const correctCount = attempt.answers.filter((a) => a.isCorrect).length;
        pointsEarned += correctCount * 10;
    });

    const pendingExams = allExams
        .filter((exam) => {
            const notCompleted = !completedExamIds.has(exam._id.toString());
            const notExpired = exam.closingAt > nowInSeconds;
            return notCompleted && notExpired;
        })
        .map((exam) => {
            // حساب الـ due time
            const secondsLeft = exam.closingAt - nowInSeconds;
            const daysLeft = Math.ceil(secondsLeft / (60 * 60 * 24));

            let dueLabel = "";
            if (daysLeft <= 0) dueLabel = "Due today";
            else if (daysLeft === 1) dueLabel = "Due tomorrow";
            else dueLabel = `Due in ${daysLeft} days`;

            return {
                examId: exam._id,
                title: exam.title,
                subject: Array.isArray(exam.groupID) ? exam.groupID[0]?.subject : exam.groupID?.subject,
                teacherName: exam.teacherID?.name,
                durationMinutes: exam.durationMinutes,
                numOfQuestion: exam.numOfQuestion,
                openingAt: exam.openingAt,
                closingAt: exam.closingAt,
                dueLabel,
                isAvailable: exam.openingAt <= nowInSeconds,
            };
        })
        .sort((a, b) => a.closingAt - b.closingAt);

    return successResponse({
        res,
        statusCode: 200,
        message: "Student dashboard fetched successfully",
        data: {
            studentName: req.user.name,
            stats: {
                totalExamsAssigned,
                totalCompleted,
                overallProgress,
                pointsEarned,
            },
            assignedExams: pendingExams,
        },
    });
};
