import ExamModel from "../../DB/model/exam.model.js";
import QuestionModel from "../../DB/model/question.model.js";
import ExamAttemptModel from "../../DB/model/examAttempt.model.js";
import UserModel from "../../DB/model/user.model.js";
import successResponse from "../../Utlis/successRespone.utlis.js";

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

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

    // Check if there is an active (unfinished) attempt to resume
    const activeAttempt = await ExamAttemptModel.findOne({ examID: examId, studentID, endTime: { $exists: false } });
    if (activeAttempt) {
        // Resume unfinished attempt
        const targetExamId = exam.parentExamID || examId;
        let questions = await QuestionModel.find({ examID: targetExamId }).select(
            "title options typeQue difficulty cognitiveLevel"
        );
        if (exam.randomizeQuestions) {
            questions = shuffleArray(questions);
        }
        return successResponse({
            res,
            statusCode: 200,
            message: "Exam resumed successfully",
            data: {
                attemptId: activeAttempt._id,
                startTime: activeAttempt.startTime,
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

    // No active attempt. Check if they already submitted this exam before
    if (!isCreator) {
        const finishedAttempt = await ExamAttemptModel.findOne({ examID: examId, studentID, endTime: { $exists: true } });
        if (finishedAttempt) {
            return next(new Error("You have already submitted this exam", { cause: 409 }));
        }
    }


    const targetExamId = exam.parentExamID || examId;
    let questions = await QuestionModel.find({ examID: targetExamId }).select(
        "title options typeQue difficulty cognitiveLevel"
    );
    if (exam.randomizeQuestions) {
        questions = shuffleArray(questions);
    }

    // Deduct 0.5 credits from the teacher if the student is starting a teacher-created exam
    if (!isCreator && exam.teacherID) {
        const teacher = await UserModel.findById(exam.teacherID);
        if (teacher && teacher.role === "Teacher") {
            teacher.available_credits = Math.max(0, teacher.available_credits - 0.5);
            await teacher.save();
            console.log(`💸 Deducted 0.5 credits from teacher ${teacher.name} for student exam entry. New balance: ${teacher.available_credits}`);
        }
    }

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
            startTime: attempt.startTime,
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

    const exam = await ExamModel.findById(attempt.examID);
    if (!exam) {
        return next(new Error("Exam not found", { cause: 404 }));
    }
    const targetExamId = exam.parentExamID || exam._id;

    const allQuestions = await QuestionModel.find({ examID: targetExamId }).select(
        "correctAnswer"
    );

    const submittedAnswersMap = {};
    if (Array.isArray(answers)) {
        answers.forEach((a) => {
            if (a.questionId) {
                submittedAnswersMap[a.questionId.toString()] = a.studentAnswer;
            }
        });
    }

    let score = 0;
    const gradedAnswers = allQuestions.map((q) => {
        const qIdStr = q._id.toString();
        const hasAnswered = qIdStr in submittedAnswersMap;
        const studentAnswer = hasAnswered ? submittedAnswersMap[qIdStr] : null;

        const correct = q.correctAnswer;
        const isCorrect =
            correct &&
            studentAnswer &&
            studentAnswer.trim().toLowerCase() === correct.trim().toLowerCase();

        if (isCorrect) score++;

        return {
            questionId: q._id,
            studentAnswer: studentAnswer || null,
            isCorrect: !!isCorrect,
        };
    });

    const totalQuestions = allQuestions.length;
    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;

    attempt.answers = gradedAnswers;
    attempt.totalScore = score;
    attempt.endTime = new Date();
    await attempt.save();

    const isPractice = exam.teacherID?.toString() === studentID.toString();
    const allowReview = exam.allowReview !== false || isPractice;

    return successResponse({
        res,
        statusCode: 200,
        message: "Exam submitted successfully",
        data: {
            attemptId: attempt._id,
            totalQuestions,
            correctAnswers: score,
            percentage,
            answers: allowReview ? gradedAnswers : [],
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
            select: "title durationMinutes groupID teacherID createdAt allowReview numOfQuestion",
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

    const totalQuestions = attempt.examID?.numOfQuestion || attempt.answers.length;
    const correctCount = attempt.answers.filter((a) => a.isCorrect).length;
    const incorrectCount = totalQuestions - correctCount;
    const percentage =
        totalQuestions > 0 ? Math.round((attempt.totalScore / totalQuestions) * 100) : 0;

    const isPractice = attempt.examID?.teacherID?.toString() === studentID.toString();
    const allowReview = attempt.examID?.allowReview !== false || isPractice;

    const formattedAnswers = attempt.answers.map((a, index) => {
        const questionObj = {
            questionNumber: index + 1,
            question: a.questionId?.title,
            options: a.questionId?.options,
            typeQue: a.questionId?.typeQue,
            difficulty: a.questionId?.difficulty,
            cognitiveLevel: a.questionId?.cognitiveLevel,
            studentAnswer: a.studentAnswer,
            isCorrect: a.isCorrect,
        };

        if (allowReview) {
            questionObj.correctAnswer = a.questionId?.correctAnswer;
            questionObj.ai_explanation = a.isCorrect ? null : a.questionId?.ai_explanation;
        }

        return questionObj;
    });

    return successResponse({
        res,
        statusCode: 200,
        message: "Result fetched successfully",
        data: {
            exam: {
                id: attempt.examID?._id,
                title: attempt.examID?.title,
                isPractice,
                subject: (() => {
                    if (isPractice) return "Personal Practice";
                    return Array.isArray(attempt.examID?.groupID)
                        ? attempt.examID.groupID[0]?.subject
                        : attempt.examID?.groupID?.subject;
                })(),
                groupName: (() => {
                    if (isPractice) return "Practice Exam";
                    return Array.isArray(attempt.examID?.groupID)
                        ? attempt.examID.groupID[0]?.groupName
                        : attempt.examID?.groupID?.groupName;
                })(),
                durationMinutes: attempt.examID?.durationMinutes,
                date: attempt.startTime,
                allowReview,
            },
            totalQuestions,
            correctCount,
            incorrectCount,
            totalScore: attempt.totalScore,
            percentage,
            startTime: attempt.startTime,
            endTime: attempt.endTime,
            answers: allowReview ? formattedAnswers : [],
        },
    });
};
