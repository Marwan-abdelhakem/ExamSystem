import ExamModel from "../../DB/model/exam.model.js";
import successResponse from "../../Utlis/successRespone.utlis.js";

export const getTeacherDashboard = async (req, res, next) => {
    const teacherID = req.user._id;

    const totalExamsGenerated = await ExamModel.countDocuments({ teacherID });

    const nowInSeconds = Math.floor(Date.now() / 1000);
    const sevenDaysLaterInSeconds = nowInSeconds + 7 * 24 * 60 * 60;

    const upcomingExamsCount = await ExamModel.countDocuments({
        teacherID,
        openingAt: { $gte: nowInSeconds, $lte: sevenDaysLaterInSeconds },
    });

    const recentExams = await ExamModel.find({ teacherID })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate({ path: "groupID", select: "groupName subject" })
        .select("title status numOfQuestion openingAt closingAt createdAt groupID");

    return successResponse({
        res,
        statusCode: 200,
        message: "Dashboard data fetched successfully",
        data: {
            teacherName: req.user.name,
            totalExamsGenerated,
            upcomingExamsCount,
            recentExams,
        },
    });
};
