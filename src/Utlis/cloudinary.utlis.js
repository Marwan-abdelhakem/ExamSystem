import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";

const uploadToCloudinary = (fileBuffer) => {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { resource_type: "auto", folder: "jobs" },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
    });
};

export default uploadToCloudinary;
