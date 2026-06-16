export const checkExamLimits = (req, res, next) => {
  const userRole = req.user?.role;
  const totalQuestions = req.body.totalQuestions;

  if (!userRole) {
    return res
      .status(401)
      .json({ error: "Unauthorized. User role not found." });
  }

  const isFreeTier = !req.user?.subscription_type || req.user.subscription_type === "free";

  if (userRole === "Student" && isFreeTier && totalQuestions > 10) {
    return res.status(400).json({
      error: "Limit Exceeded",
      message:
        "Students on the free tier are only allowed to generate up to 10 questions for self-practice.",
    });
  }

  if (userRole === "Teacher" && totalQuestions > 100) {
    return res.status(400).json({
      error: "Limit Exceeded",
      message:
        "Teachers are limited to generating up to 100 questions per exam.",
    });
  }
  next();
};
