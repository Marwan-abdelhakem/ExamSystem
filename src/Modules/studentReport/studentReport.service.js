import ExamAttemptModel from "../../DB/model/examAttempt.model.js";
import successResponse from "../../Utlis/successRespone.utlis.js";


const getGrade = (percentage) => {
    if (percentage >= 97) return "A+";
    if (percentage >= 93) return "A";
    if (percentage >= 90) return "A-";
    if (percentage >= 87) return "B+";
    if (percentage >= 83) return "B";
    if (percentage >= 80) return "B-";
    if (percentage >= 77) return "C+";
    if (percentage >= 73) return "C";
    if (percentage >= 70) return "C-";
    if (percentage >= 60) return "D";
    return "F";
};


const getStatus = (percentage) => {
    if (percentage >= 90) return "Excellent";
    if (percentage >= 75) return "Pass";
    if (percentage >= 60) return "Need Focus";
    return "Fail";
};


export const getStudentReport = async (req, res, next) => {
    const studentID = req.user._id;

    const attempts = await ExamAttemptModel.find({
        studentID,
        endTime: { $exists: true, $ne: null },
    })
        .sort({ createdAt: -1 })
        .populate({
            path: "examID",
            select: "title numOfQuestion durationMinutes groupID createdAt",
            populate: {
                path: "groupID",
                select: "subject groupName",
            },
        });

    if (attempts.length === 0) {
        return successResponse({
            res,
            statusCode: 200,
            message: "No completed exams found",
            data: {
                performanceTrend: [],
                cumulativeAverage: { percentage: 0, grade: "N/A", trend: 0 },
                recentExams: [],
                subjectSummary: [],
            },
        });
    }

    const monthlyMap = {};
    attempts.forEach((attempt) => {
        const totalQ = attempt.examID?.numOfQuestion || attempt.answers.length;
        const percentage = totalQ > 0 ? Math.round((attempt.totalScore / totalQ) * 100) : 0;

        const date = new Date(attempt.startTime);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const label = date.toLocaleString("en-US", { month: "short" });

        if (!monthlyMap[key]) {
            monthlyMap[key] = { label, scores: [] };
        }
        monthlyMap[key].scores.push(percentage);
    });

    const performanceTrend = Object.keys(monthlyMap)
        .sort()
        .map((key) => {
            const scores = monthlyMap[key].scores;
            const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
            return { month: monthlyMap[key].label, avgScore: avg };
        });

    const allPercentages = attempts.map((attempt) => {
        const totalQ = attempt.examID?.numOfQuestion || attempt.answers.length;
        return totalQ > 0 ? Math.round((attempt.totalScore / totalQ) * 100) : 0;
    });

    const cumulativePercentage = Math.round(
        allPercentages.reduce((a, b) => a + b, 0) / allPercentages.length
    );

    let trend = 0;
    if (allPercentages.length >= 2) {
        trend = parseFloat((allPercentages[0] - allPercentages[1]).toFixed(1));
    }

    const cumulativeAverage = {
        percentage: cumulativePercentage,
        grade: getGrade(cumulativePercentage),
        trend,
    };

    const recentExams = attempts.slice(0, 6).map((attempt) => {
        const totalQ = attempt.examID?.numOfQuestion || attempt.answers.length;
        const correctCount = attempt.answers.filter((a) => a.isCorrect).length;
        const percentage = totalQ > 0 ? Math.round((attempt.totalScore / totalQ) * 100) : 0;

        const timeSpentMs = attempt.endTime - attempt.startTime;
        const timeSpentMins = Math.round(timeSpentMs / 1000 / 60);

        return {
            attemptId: attempt._id,
            examTitle: attempt.examID?.title,
            subject: (Array.isArray(attempt.examID?.groupID) && attempt.examID.groupID.length > 0 ? attempt.examID.groupID[0]?.subject : attempt.examID?.groupID?.subject) || "General Practice",
            date: attempt.startTime,
            score: attempt.totalScore,
            totalQuestions: totalQ,
            correctCount,
            percentage,
            timeSpentMins,
            grade: getGrade(percentage),
        };
    });

    const subjectMap = {};
    attempts.forEach((attempt) => {
        const subject = (Array.isArray(attempt.examID?.groupID) && attempt.examID.groupID.length > 0 ? attempt.examID.groupID[0]?.subject : attempt.examID?.groupID?.subject) || "General Practice";
        const totalQ = attempt.examID?.numOfQuestion || attempt.answers.length;
        const percentage = totalQ > 0 ? Math.round((attempt.totalScore / totalQ) * 100) : 0;

        if (!subjectMap[subject]) {
            subjectMap[subject] = { examsTaken: 0, percentages: [] };
        }
        subjectMap[subject].examsTaken++;
        subjectMap[subject].percentages.push(percentage);
    });

    const subjectSummary = Object.entries(subjectMap).map(([subject, data]) => {
        const avgScore = Math.round(
            data.percentages.reduce((a, b) => a + b, 0) / data.percentages.length
        );
        return {
            subject,
            examsTaken: data.examsTaken,
            avgScore,
            status: getStatus(avgScore),
        };
    });

    return successResponse({
        res,
        statusCode: 200,
        message: "Student report fetched successfully",
        data: {
            performanceTrend,
            cumulativeAverage,
            recentExams,
            subjectSummary,
        },
    });
};
