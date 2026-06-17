import ExamModel from "../../DB/model/exam.model.js";
import QuestionModel from "../../DB/model/question.model.js";
import ExamAttemptModel from "../../DB/model/examAttempt.model.js";
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

    const recentExamsWithDifficulty = await Promise.all(
      recentExams.map(async (exam) => {
        const questions = await QuestionModel.find({ examID: exam._id }).select("difficulty");
        let difficulty = "Varied";
        if (questions.length > 0) {
          const uniqueDifficulties = [...new Set(questions.map((q) => q.difficulty))];
          if (uniqueDifficulties.length === 1) {
            difficulty = uniqueDifficulties[0];
          }
        }
        return {
          ...exam.toObject(),
          difficulty,
        };
      })
    );

    // Calculate Average Cohort Score
    const exams = await ExamModel.find({ teacherID });
    const examIds = exams.map(e => e._id);
    const attempts = await ExamAttemptModel.find({ 
      examID: { $in: examIds },
      endTime: { $exists: true, $ne: null }
    });
    
    let averageCohortScore = 0;
    if (attempts.length > 0) {
      let totalPercentageSum = 0;
      attempts.forEach(attempt => {
        const exam = exams.find(e => e._id.toString() === attempt.examID.toString());
        const maxScore = exam ? exam.numOfQuestion : 10;
        const scorePercentage = (attempt.totalScore / (maxScore || 10)) * 100;
        totalPercentageSum += scorePercentage;
      });
      averageCohortScore = Number((totalPercentageSum / attempts.length).toFixed(1));
    }

    return successResponse({
        res,
        statusCode: 200,
        message: "Dashboard data fetched successfully",
        data: {
            teacherName: req.user.name,
            totalExamsGenerated,
            upcomingExamsCount,
            recentExams: recentExamsWithDifficulty,
            averageCohortScore,
        },
    });
};
