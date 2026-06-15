import UserModel from "../../DB/model/user.model.js";
import { hashPassword, comparePassowrd } from "../../Utlis/hash.utlis.js";
import uploadToCloudinary from "../../Utlis/cloudinary.utlis.js";
import successResponse from "../../Utlis/successRespone.utlis.js";


export const getProfile = async (req, res, next) => {
    const user = await UserModel.findById(req.user._id).select(
        "-password -otp"
    );

    if (!user) {
        return next(new Error("User not found", { cause: 404 }));
    }

    return successResponse({
        res,
        statusCode: 200,
        message: "Profile fetched successfully",
        data: {
            name: user.name,
            email: user.email,
            role: user.role,
            avatar: user.avatar || null,
            educational_level: user.educational_level || null,
            subjects_taught: user.subjects_taught || null,
            qualification: user.qualification || null,
            subscription_type: user.subscription_type,
            available_credits: user.available_credits,
            subscription_credits: user.subscription_credits,
            purchased_credits: user.purchased_credits,
            subscription_expires_at: user.subscription_expires_at,
            memberSince: user.createdAt,
            preferences: {
                emailNotifications: user.preferences?.emailNotifications ?? true,
                aiInsights: user.preferences?.aiInsights ?? false,
            },
        },
    });
};


export const updatePhoto = async (req, res, next) => {
    if (!req.file) {
        return next(new Error("Please upload an image", { cause: 400 }));
    }

    const avatarUrl = await uploadToCloudinary(req.file.buffer);

    const user = await UserModel.findByIdAndUpdate(
        req.user._id,
        { avatar: avatarUrl },
        { new: true }
    ).select("-password -otp");

    return successResponse({
        res,
        statusCode: 200,
        message: "Photo updated successfully",
        data: { avatar: user.avatar },
    });
};


export const updateInfo = async (req, res, next) => {
    const { name, email, educational_level, subjects_taught } = req.body;

    if (email && email !== req.user.email) {
        const exists = await UserModel.findOne({ email });
        if (exists) {
            return next(new Error("Email already in use", { cause: 409 }));
        }
    }

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (educational_level) updates.educational_level = educational_level;
    if (subjects_taught) updates.subjects_taught = subjects_taught;

    const user = await UserModel.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true, runValidators: true }
    ).select("-password -otp");

    return successResponse({
        res,
        statusCode: 200,
        message: "Profile updated successfully",
        data: {
            name: user.name,
            email: user.email,
            educational_level: user.educational_level,
            subjects_taught: user.subjects_taught,
        },
    });
};


export const changePassword = async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    const user = await UserModel.findById(req.user._id);
    if (!user) {
        return next(new Error("User not found", { cause: 404 }));
    }

    const isMatch = await comparePassowrd({
        plainText: currentPassword,
        hashPassword: user.password,
    });

    if (!isMatch) {
        return next(new Error("Current password is incorrect", { cause: 400 }));
    }

    const hashed = await hashPassword({ plainText: newPassword, saltRounds: 12 });
    user.password = hashed;
    await user.save();

    return successResponse({
        res,
        statusCode: 200,
        message: "Password changed successfully",
    });
};

export const updatePreferences = async (req, res, next) => {
    const { emailNotifications, aiInsights } = req.body;

    const updates = {};
    if (emailNotifications !== undefined) updates["preferences.emailNotifications"] = emailNotifications;
    if (aiInsights !== undefined) updates["preferences.aiInsights"] = aiInsights;

    const user = await UserModel.findByIdAndUpdate(
        req.user._id,
        updates,
        { new: true }
    ).select("preferences");

    return successResponse({
        res,
        statusCode: 200,
        message: "Preferences updated successfully",
        data: user.preferences,
    });
};

export const deactivateAccount = async (req, res, next) => {
    await UserModel.findByIdAndDelete(req.user._id);

    res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
    });

    return successResponse({
        res,
        statusCode: 200,
        message: "Account deactivated successfully",
    });
};

export const updateCreditsAfterCheckout = async (req, res, next) => {
    const { available_credits, subscription_credits, purchased_credits, subscription_type } = req.body;

    try {
        const user = await UserModel.findById(req.user._id);
        if (!user) {
            return next(new Error("User not found", { cause: 404 }));
        }

        if (available_credits !== undefined) user.available_credits = available_credits;
        if (subscription_credits !== undefined) user.subscription_credits = subscription_credits;
        if (purchased_credits !== undefined) user.purchased_credits = purchased_credits;
        if (subscription_type !== undefined) user.subscription_type = subscription_type;

        await user.save();

        return successResponse({
            res,
            statusCode: 200,
            message: "Credits and subscription updated successfully",
            data: {
                available_credits: user.available_credits,
                subscription_credits: user.subscription_credits,
                purchased_credits: user.purchased_credits,
                subscription_type: user.subscription_type,
            },
        });
    } catch (error) {
        return next(error);
    }
};
