import mongoose, { Schema } from "mongoose";
const imageSchema = new Schema({
    avatar: { type: String, required: true },
}, { timestamps: true });
export const ImageModel = mongoose.model("Image", imageSchema);
