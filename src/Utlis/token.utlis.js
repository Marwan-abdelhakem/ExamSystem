import jwt from "jsonwebtoken"

export const signToken = ({ payload = {}, signature = process.env.JWT_SECRET, options = {
    expiresIn: "1d",
} }) => {
    return jwt.sign(payload, signature, options)
}

export const verifyTokin = ({ token = "", signature = process.env.JWT_SECRET }) => {
    return jwt.verify(token, signature)
}