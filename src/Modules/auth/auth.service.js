import UserModel from "../../DB/model/user.model.js";
import { comparePassowrd, hashPassword } from "../../Utlis/hash.utlis.js";
import { signToken } from "../../Utlis/token.utlis.js";
import successResponse from "../../Utlis/successRespone.utlis.js";
import uploadToCloudinary from "../../Utlis/cloudinary.utlis.js";
import { checkCertificateWithAI } from "../../Utlis/checkCertificateWithAI.utlis.js";
import { sendCode } from "../../Utlis/sendEmail.utlis.js";
import { RandomString } from "../../Utlis/generateOtp.js";

export const signUp = async (req, res, next) => {
  const { role, name, email, password, subjects_taught, educational_level } =
    req.body;

  const user = await UserModel.findOne({ email });
  if (user) {
    return next(new Error("Email already exists", { cause: 400 })); //check
  }

  const hashedPassword = await hashPassword({ plainText: password });

  let fileUrl = null;
  if (role == "Teacher") {
    if (!req.file || !subjects_taught) {
      return next(new Error("qualification and subjects_taught  is required"));
    }
    const isCertValid = await checkCertificateWithAI(
      req.file.buffer,
      req.file.mimetype,
    );

    if (!isCertValid) {
      return next(new Error("qualification is vaild", { cause: 400 }));
    }

    fileUrl = await uploadToCloudinary(req.file.buffer);
  }

  if (role == "Student") {
    if (!educational_level) {
      return next(new Error("educational_level  is required"));
    }
  }

  const createUser = await UserModel.create({
    success: true,
    role,
    name,
    password: hashedPassword,
    email,
    subjects_taught,
    educational_level,
    qualification: fileUrl,
    educational_level,
  });

  return successResponse({
    res,
    statusCode: 201,
    message: "User Create Successfully",
    data: createUser,
  });
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isPasswordValid = await comparePassowrd({
      plainText: password,
      hashPassword: user.password,
    });

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken({
      payload: {
        id: user._id,
        email: user.email,
      },
    });
    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const sendOtp = async (req, res, next) => {
  const { email } = req.body;
  const user = await UserModel.findOne({ email });

  if (!user) return next(new Error("User not found", { cause: 404 }));

  const cooldown = 60 * 1000;
  if (
    user.otp.last_sent_at &&
    Date.now() - user.otp.last_sent_at < cooldown
  ) {
    return next(
      new Error("Please wait 1 minute before requesting another OTP", {
        cause: 429,
      }),
    );
  }

  const otp = RandomString(6);

  user.otp = {
    code: otp,
    expiry_date: Date.now() + 15 * 60 * 1000,
    last_sent_at: Date.now(),
    attempts: 0,
    verified: false,
  };

  await user.save();
  await sendCode(otp, user.email);

  return successResponse({
    success: true,
    statusCode: 200,
    message: "OTP sent successfully",
  });
};

export const verifyOtp = async (req, res, next) => {
  const { email, code } = req.body;
  const user = await UserModel.findOne({ email });

  if (!user) return next(new Error("User not found", { cause: 404 }));

  if (user.otp.attempts >= 3) {
    return next(
      new Error("Too many failed attempts. Please request a new OTP", {
        cause: 400,
      }),
    );
  }

  if (
    !user.otp.code ||
    user.otp.expiry_date < Date.now()
  ) {
    return next(new Error("OTP expired or not requested", { cause: 400 }));
  }

  if (String(user.otp.code) !== String(code)) {
    user.otp.attempts += 1;
    await user.save();
    return next(new Error("Invalid OTP", { cause: 400 }));
  }

  user.otp.verified = true;
  user.otp.attempts = 0;
  await user.save();

  return successResponse({
    success: true,
    statusCode: 200,
    message: "OTP verified successfully",
  });
};

export const resetPassword = async (req, res, next) => {
  const { email, code, password } = req.body;

  const user = await UserModel.findOne({ email });

  if (!user) return next(new Error("User not found", { cause: 404 }));

  if (
    !user.otp.verified ||
    String(user.otp.code) !== String(code)
  ) {
    return next(new Error("OTP not verified or invalid", { cause: 400 }));
  }

  if (user.otp.expiry_date < Date.now()) {
    return next(new Error("OTP expired", { cause: 400 }));
  }

  user.password = await hashPassword({ plainText: password });

  user.otp = {
    code: null,
    expiry_date: null,
    last_sent_at: null,
    attempts: 0,
    verified: false,
  };

  await user.save();

  return successResponse({
    success: true,
    statusCode: 200,
    message: "Password reset successfully",
  });
};