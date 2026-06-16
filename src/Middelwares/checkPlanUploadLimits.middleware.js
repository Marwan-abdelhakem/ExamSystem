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

  const limits = {
    free: 5,
    lite: 10,
    premium: 20,
    institution: 20,
  };

  const maxMB = limits[plan] ?? 5; // default to free limit for unknown plans

  if (fileSizeInMB > maxMB) {
    return res.status(400).json({
      error: "File size limit exceeded.",
      message: `Your plan (${plan}) allows up to ${maxMB}MB per PDF. Your file is ${fileSizeInMB.toFixed(2)} MB. Please upgrade your plan or use a smaller file.`,
    });
  }

  next();
};
