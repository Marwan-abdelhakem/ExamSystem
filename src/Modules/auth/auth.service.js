import UserModel from "../../DB/model/user.model.js";
import { comparePassowrd, hashPassword } from "../../Utlis/hash.utlis.js";
import { signToken } from "../../Utlis/token.utlis.js";
import successResponse from "../../Utlis/successRespone.utlis.js"
import uploadToCloudinary from "../../Utlis/cloudinary.utlis.js";
import { checkCertificateWithAI } from "../../Utlis/checkCertificateWithAI.utlis.js";


export const signUp = async (req, res, next) => {
    const { role, name, email, password, subjects_taught, educational_level } = req.body

    const user = await UserModel.findOne({ email })
    if (user) {
        return next(new Error("Email already exists", { cause: 400 })) //check 
    }

    const hashedPassword = await hashPassword({ plainText: password })

    let fileUrl = null
    if (role == "Teacher") {
        if (!req.file || !subjects_taught) {
            return next(new Error("qualification and subjects_taught  is required"))
        }
        const isCertValid = await checkCertificateWithAI(req.file.buffer, req.file.mimetype);

        if (!isCertValid) {
            return next(new Error("qualification is vaild", { cause: 400 }));
        }

        fileUrl = await uploadToCloudinary(req.file.buffer)
    }

    if (role == "Student") {
        if (!educational_level) {
            return next(new Error("educational_level  is required"))
        }
    }

    const createUser = await UserModel.create({ role, name, password: hashedPassword, email, subjects_taught, educational_level, qualification: fileUrl, educational_level })

    return successResponse({ res, statusCode: 201, message: "User Create Successfully", data: createUser })
}

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

