import jwt from "jsonwebtoken";

export const signToken = ({
    payload = {},
    signature = process.env.JWT_SECRET,
    options = { expiresIn: "15m" },
}) => {
    return jwt.sign(payload, signature, options);
};

export const signRefreshToken = ({ payload = {} }) => {
    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
};

export const verifyTokin = ({ token = "", signature = process.env.JWT_SECRET }) => {
    return jwt.verify(token, signature);
};

export const verifyRefreshToken = ({ token = "" }) => {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};
