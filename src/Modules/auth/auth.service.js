import UserModel from "../../DB/model/user.model.js";
import RefreshTokenModel from "../../DB/model/refreshToken.model.js";
import { comparePassowrd, hashPassword } from "../../Utlis/hash.utlis.js";
import {
  signToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../Utlis/token.utlis.js";
import successResponse from "../../Utlis/successRespone.utlis.js";
import uploadToCloudinary from "../../Utlis/cloudinary.utlis.js";
import { checkCertificateWithAI } from "../../Utlis/checkCertificateWithAI.utlis.js";
import { sendEmail } from "../../Utlis/sendEmail.js";
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

  const otp = RandomString(6);
  const otpExpiry = Date.now() + 15 * 60 * 1000;

  const createUser = await UserModel.create({
    role,
    name,
    password: hashedPassword,
    email,
    subjects_taught,
    educational_level,
    qualification: fileUrl,
    otp: {
      code: otp,
      expiry_date: otpExpiry,
      last_sent_at: Date.now(),
      attempts: 0,
      verified: false,
    },
  });

  await sendEmail(email, otp);

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

    if (!user.otp || !user.otp.verified) {
      return res.status(403).json({
        message: "Please verify your email first",
        notVerified: true,
        email: user.email,
      });
    }

    const token = signToken({
      payload: {
        id: user._id,
        email: user.email,
      },
    });

    const refreshToken = signRefreshToken({
      payload: { id: user._id, email: user.email },
    });

    // Save refresh token in DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await RefreshTokenModel.create({
      token: refreshToken,
      userId: user._id,
      expiresAt,
    });

    // Send refresh token in httpOnly cookie — not accessible via JS (XSS safe)
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        subscription_type: user.subscription_type,
        available_credits: user.available_credits,
        role: user.role,
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
  if (user.otp.last_sent_at && Date.now() - user.otp.last_sent_at < cooldown) {
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
  await sendEmail(user.email, otp);

  return successResponse({
    res,
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

  if (!user.otp.code || user.otp.expiry_date < Date.now()) {
    return next(new Error("OTP expired or not requested", { cause: 400 }));
  }

  if (String(user.otp.code) !== String(code)) {
    user.otp.attempts += 1;
    await user.save();
    return next(new Error("Invalid OTP", { cause: 400 }));
  }
  user.otp.code = null;
  user.otp.verified = true;
  user.otp.attempts = 0;
  user.otp.last_sent_at = null;
  user.otp.expiry_date = null;
  await user.save();

  return successResponse({
    res,
    statusCode: 200,
    message: "OTP verified successfully",
  });
};

export const resetPassword = async (req, res, next) => {
  const { email, password } = req.body;

  const user = await UserModel.findOne({ email });

  if (!user) return next(new Error("User not found", { cause: 404 }));

  if (!user.otp.verified) {
    return next(new Error("OTP not verified", { cause: 400 }));
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
    res,
    statusCode: 200,
    message: "Password reset successfully",
  });
};

export const refreshToken = async (req, res, next) => {
  const token = req.cookies?.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "No refresh token provided" });
  }

  try {
    const decoded = verifyRefreshToken({ token });

    const storedToken = await RefreshTokenModel.findOne({
      token,
      userId: decoded.id,
      expiresAt: { $gt: new Date() },
    });

    if (!storedToken) {
      return res
        .status(403)
        .json({ message: "Refresh token revoked or expired" });
    }

    const user = await UserModel.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const newAccessToken = signToken({
      payload: { id: user._id, email: user.email },
    });

    // Rotate refresh token — delete old, save new
    const newRefreshToken = signRefreshToken({
      payload: { id: user._id, email: user.email },
    });

    await RefreshTokenModel.deleteOne({ token });

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await RefreshTokenModel.create({
      token: newRefreshToken,
      userId: user._id,
      expiresAt,
    });

    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      token: newAccessToken,
    });
  } catch (error) {
    return res
      .status(403)
      .json({ message: "Invalid or expired refresh token" });
  }
};

export const logout = async (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try {
      await RefreshTokenModel.deleteOne({ token });
    } catch (error) {
      console.error("Logout error:", error);
    }
  }
  res.clearCookie("accessToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  return res
    .status(200)
    .json({ success: true, message: "Logged out successfully" });
};

export const getMe = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(404).json({ message: "User not found" });
    }
    const user = req.user.toObject ? req.user.toObject() : { ...req.user };
    delete user.password;
    delete user.otp;
    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    return next(new Error("Failed to get profile", { cause: 500 }));
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;
    const user = await UserModel.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) {
      user.name = name;
    }

    if (req.file) {
      const avatarUrl = await uploadToCloudinary(req.file.buffer);
      user.avatar = avatarUrl;
    }

    await user.save();

    const updatedUser = user.toObject ? user.toObject() : { ...user };
    delete updatedUser.password;
    delete updatedUser.otp;

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Update profile error:", error);
    return next(new Error("Failed to update profile", { cause: 500 }));
  }
};

export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Current and new password are required" });
    }

    const user = await UserModel.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await comparePassowrd({
      plainText: currentPassword,
      hashPassword: user.password,
    });
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    user.password = await hashPassword({ plainText: newPassword });
    await user.save();

    // Revoke any refresh tokens to force re-login across sessions
    try {
      await RefreshTokenModel.deleteMany({ userId: user._id });
    } catch (err) {
      console.error(
        "Failed to revoke refresh tokens after password change:",
        err,
      );
    }

    // Clear refresh cookie if present
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return successResponse({
      res,
      statusCode: 200,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return next(new Error("Failed to change password", { cause: 500 }));
  }
};
