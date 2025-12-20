import { ImageModel } from "../model/image.js";
import { uploadCloudinary } from "../utils/cloudinary.js";
export const uploadAvatar = async (req, res) => {
    console.log(" req.files:", req.files);
    const file = req.files?.avatar?.[0];
    if (!file) {
        return res.status(400).json({ message: " avatar file is required" });
    }
    const avatarLocalPath = file.path;
    const uploaded = await uploadCloudinary(avatarLocalPath);
    if (!uploaded?.url) {
        return res.status(400).json({ message: "Cloudinary upload failed" });
    }
    const image = await ImageModel.create({ avatar: uploaded.url });
    return res.status(201).json({
        message: "User image uploaded successfully",
        data: image,
    });
};
export const getAllImages = async (req, res) => {
    const images = await ImageModel.find();
    return res.status(200).json({
        message: "All images fetched successfully",
        data: images,
    });
};
