import { verifyTokin } from "../Utlis/token.utlis.js";
import UserModel from "../DB/model/User.model.js";

export const authentication = async (req, res, next) => {
    let token = req.headers.authorization || req.cookies.accessToken;

    if (!token) {
        return next(new Error("Token required!", { cause: 401 }));
    }

    // Remove "Bearer " prefix if exists
    if (token.startsWith('Bearer ')) {
        token = token.slice(7);
    }

    try {
        const decoded = verifyTokin({ token });
        const user = await UserModel.findById(decoded._id);

        if (!user) {
            return next(new Error("User Not Found", { cause: 404 }));
        }

        req.user = user;
        return next();
    } catch (err) {
        return next(new Error("Invalid Token", { cause: 401 }));
    }
}

export const authorization = ({ role = [] }) => {
    return async (req, res, next) => {
        if (!role.includes(req.user.role)) {
            return next(new Error("Unauthorized", { cause: 403 }))
        }
        return next()
    }
}