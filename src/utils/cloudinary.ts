import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
  throw new Error(" Cloudinary environment variables not set");
}

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

export const uploadCloudinary = async (localFilePath: string): Promise<UploadApiResponse | null> => {
  try {
    if (!fs.existsSync(localFilePath)) {
      console.log(" File not found:", localFilePath);
      return null;
    }

    console.log("Uploading to Cloudinary:", localFilePath);
    const result = await cloudinary.uploader.upload(localFilePath, { resource_type: "auto" });

    fs.unlinkSync(localFilePath);
    console.log(" Local file deleted after upload");

    return result;
  } catch (error) {
    console.error(" Cloudinary upload error:", error);

    if (fs.existsSync(localFilePath)) {
      try {
        fs.unlinkSync(localFilePath);
      } catch (unlinkError) {
        console.error(" Failed to delete temp file:", unlinkError);
      }
    }

    return null;
  }
};
