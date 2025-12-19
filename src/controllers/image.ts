import { Request, Response } from "express";
import { ImageModel } from "../model/image.js";
import { uploadCloudinary } from "../utils/cloudinary.js";

interface MulterRequest extends Request {
  files?: {
    avatar?: Express.Multer.File[];
  };
}

export const uploadAvatar = async (req: MulterRequest, res: Response): Promise<Response> => {
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

export const getAllImages = async (req: Request, res: Response): Promise<Response> => {
  const images = await ImageModel.find();
  return res.status(200).json({
    message: "All images fetched successfully",
    data: images,
  });
};