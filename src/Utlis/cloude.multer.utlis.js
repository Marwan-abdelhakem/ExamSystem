import multer from "multer"

export const cloudFileUpload = () => {
    const storage = multer.diskStorage({})
    return multer({
        storage
    })
}