import bcrypt, { hash } from "bcryptjs"

export const hashPassword = async ({ plainText = "", saltRounds = 12 }) => {
    return await bcrypt.hash(plainText, saltRounds)
}

export const comparePassowrd = async ({ plainText = "", hashPassword = "" }) => {
    return await bcrypt.compare(plainText, hashPassword)
}