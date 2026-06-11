import ExamModel from "../../DB/model/exam.model.js";
import QuestionModel from "../../DB/model/question.model.js";
import ExamAttemptModel from "../../DB/model/examAttempt.model.js";
import successResponse from "../../Utlis/successRespone.utlis.js";



export const startExam = async (req, res, next) => {
    const { examId, accessCode } = req.body;
    const studentID = req.user._id;

    const exam = await ExamModel.findById(examId).populate({
        path: "groupID",
        select: "groupName subject students",
    });

    if (!exam) {
        return next(new Error("Exam not found", { cause: 404 }));
    }

    const isCreator = exam.teacherID && exam.teacherID.toString() === studentID.toString();
    const groups = Array.isArray(exam.groupID) ? exam.groupID : [exam.groupID];
    const isEnrolled = isCreator || groups.some(group => 
        group?.students?.map((id) => id.toString()).includes(studentID.toString())
    );

    if (!isEnrolled) {
        return next(new Error("You are not enrolled in this exam's group", { cause: 403 }));
    }

    if (exam.status !== "Active") {
        return next(new Error("Exam is not active", { cause: 403 }));
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (nowInSeconds < exam.openingAt) {
        return next(new Error("Exam has not started yet", { cause: 403 }));
    }
    if (nowInSeconds > exam.closingAt) {
        return next(new Error("Exam has already closed", { cause: 403 }));
    }

    const existingAttempt = await ExamAttemptModel.findOne({ examID: examId, studentID });
    if (existingAttempt) {
        // Practice exam (student owns the exam) → allow unlimited retakes
        if (isCreator) {
            // Delete old attempt so a fresh one can be created below
            await ExamAttemptModel.deleteOne({ _id: existingAttempt._id });
        } else {
            // Teacher exam → one attempt only
            if (existingAttempt.endTime) {
                return next(new Error("You have already submitted this exam", { cause: 409 }));
            }
            // Resume unfinished attempt
            const targetExamId = exam.parentExamID || examId;
            const questions = await QuestionModel.find({ examID: targetExamId }).select(
                "title options typeQue difficulty cognitiveLevel"
            );
            return successResponse({
                res,
                statusCode: 200,
                message: "Exam resumed successfully",
                data: {
                    attemptId: existingAttempt._id,
                    exam: {
                        title: exam.title,
                        durationMinutes: exam.durationMinutes,
                        numOfQuestion: exam.numOfQuestion,
                        closingAt: exam.closingAt,
                        subject: Array.isArray(exam.groupID) ? exam.groupID[0]?.subject : exam.groupID?.subject,
                    },
                    questions,
                },
            });
        }
    }


    const targetExamId = exam.parentExamID || examId;
    const questions = await QuestionModel.find({ examID: targetExamId }).select(
        "title options typeQue difficulty cognitiveLevel"
    );

    const attempt = await ExamAttemptModel.create({
        examID: examId,
        studentID,
        startTime: new Date(),
    });

    return successResponse({
        res,
        statusCode: 201,
        message: "Exam started successfully",
        data: {
            attemptId: attempt._id,
            exam: {
                title: exam.title,
                durationMinutes: exam.durationMinutes,
                numOfQuestion: exam.numOfQuestion,
                closingAt: exam.closingAt,
                subject: Array.isArray(exam.groupID) ? exam.groupID[0]?.subject : exam.groupID?.subject,
            },
            questions,
        },
    });
};

export const submitExam = async (req, res, next) => {
    const { attemptId, answers } = req.body;
    const studentID = req.user._id;

    const attempt = await ExamAttemptModel.findById(attemptId);

    if (!attempt) {
        return next(new Error("Exam attempt not found", { cause: 404 }));
    }

    if (attempt.studentID.toString() !== studentID.toString()) {
        return next(new Error("Unauthorized", { cause: 403 }));
    }

    if (attempt.endTime) {
        return next(new Error("Exam already submitted", { cause: 409 }));
    }

    const questionIds = answers.map((a) => a.questionId);
    const questions = await QuestionModel.find({ _id: { $in: questionIds } }).select(
        "correctAnswer"
    );

    const correctAnswerMap = {};
    questions.forEach((q) => {
        correctAnswerMap[q._id.toString()] = q.correctAnswer;
    });

    let score = 0;
    const gradedAnswers = answers.map((a) => {
        const correct = correctAnswerMap[a.questionId];
        const isCorrect =
            correct && a.studentAnswer?.trim().toLowerCase() === correct.trim().toLowerCase();

        if (isCorrect) score++;

        return {
            questionId: a.questionId,
            studentAnswer: a.studentAnswer,
            isCorrect: !!isCorrect,
        };
    });

    const totalQuestions = answers.length;
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    attempt.answers = gradedAnswers;
    attempt.totalScore = score;
    attempt.endTime = new Date();
    await attempt.save();

    return successResponse({
        res,
        statusCode: 200,
        message: "Exam submitted successfully",
        data: {
            attemptId: attempt._id,
            totalQuestions,
            correctAnswers: score,
            percentage,
            answers: gradedAnswers,
        },
    });
};


export const getAttemptResult = async (req, res, next) => {
    const { attemptId } = req.params;
    const studentID = req.user._id;

    const attempt = await ExamAttemptModel.findById(attemptId)
        .populate({
            path: "answers.questionId",
            select: "title options correctAnswer typeQue difficulty cognitiveLevel ai_explanation",
        })
        .populate({
            path: "examID",
            select: "title durationMinutes groupID teacherID createdAt",
            populate: {
                path: "groupID",
                select: "subject groupName",
            },
        });

    if (!attempt) {
        return next(new Error("Attempt not found", { cause: 404 }));
    }

    if (attempt.studentID.toString() !== studentID.toString()) {
        return next(new Error("Unauthorized", { cause: 403 }));
    }

    if (!attempt.endTime) {
        return next(new Error("Exam not submitted yet", { cause: 400 }));
    }

    const totalQuestions = attempt.answers.length;
    const correctCount = attempt.answers.filter((a) => a.isCorrect).length;
    const incorrectCount = totalQuestions - correctCount;
    const percentage =
        totalQuestions > 0 ? Math.round((attempt.totalScore / totalQuestions) * 100) : 0;

    const formattedAnswers = attempt.answers.map((a, index) => ({
        questionNumber: index + 1,
        question: a.questionId?.title,
        options: a.questionId?.options,
        typeQue: a.questionId?.typeQue,
        difficulty: a.questionId?.difficulty,
        cognitiveLevel: a.questionId?.cognitiveLevel,
        studentAnswer: a.studentAnswer,
        correctAnswer: a.questionId?.correctAnswer,
        isCorrect: a.isCorrect,
        ai_explanation: a.isCorrect ? null : a.questionId?.ai_explanation,
    }));

    return successResponse({
        res,
        statusCode: 200,
        message: "Result fetched successfully",
        data: {
            exam: {
                title: attempt.examID?.title,
                isPractice: attempt.examID?.teacherID?.toString() === studentID.toString(),
                subject: (() => {
                    const isPractice = attempt.examID?.teacherID?.toString() === studentID.toString();
                    if (isPractice) return "Personal Practice";
                    return Array.isArray(attempt.examID?.groupID)
                        ? attempt.examID.groupID[0]?.subject
                        : attempt.examID?.groupID?.subject;
                })(),
                groupName: (() => {
                    const isPractice = attempt.examID?.teacherID?.toString() === studentID.toString();
                    if (isPractice) return "Practice Exam";
                    return Array.isArray(attempt.examID?.groupID)
                        ? attempt.examID.groupID[0]?.groupName
                        : attempt.examID?.groupID?.groupName;
                })(),
                durationMinutes: attempt.examID?.durationMinutes,
                date: attempt.startTime,
            },
            totalQuestions,
            correctCount,
            incorrectCount,
            totalScore: attempt.totalScore,
            percentage,
            startTime: attempt.startTime,
            endTime: attempt.endTime,
            answers: formattedAnswers,
        },
    });
};
