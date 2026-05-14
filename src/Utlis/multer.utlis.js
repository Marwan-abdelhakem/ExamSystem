import multer from "multer";

export const fileUpload = () => {
    const storage = multer.memoryStorage(); // تخزين مؤقت في الذاكرة
    return multer({ storage });
};