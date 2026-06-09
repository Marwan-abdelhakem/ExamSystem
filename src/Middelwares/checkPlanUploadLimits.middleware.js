export const checkPlanUploadLimits = (req, res, next) => {
  const user = req.user;
  const file = req.file; 

  if (!user || !file) {
    return res
      .status(400)
      .json({ error: "Missing user authentication or file." });
  }

  const fileSizeInMB = file.size / (1024 * 1024); 
  const plan = user.subscription_type;

  console.log(
    `👤 User Plan: ${plan} | Uploaded File Size: ${fileSizeInMB.toFixed(2)} MB`,
  );

  if (plan === "free" && fileSizeInMB > 5) {
    return res.status(400).json({
      error: "Limit Exceeded",
      message: `Free accounts are limited to 5MB per PDF. Your file is ${fileSizeInMB.toFixed(2)} MB. Please upgrade to Premium.`,
    });
  }

  if (plan === "premium" && fileSizeInMB > 20) {
    return res.status(400).json({
      error: "Limit Exceeded",
      message: `Premium accounts are limited to 20MB per PDF. Your file is ${fileSizeInMB.toFixed(2)} MB.`,
    });
  }
  next();
};
