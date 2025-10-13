import mongoose, { Schema, Document } from "mongoose";

interface IImage extends Document {
  avatar: string;
}

const imageSchema = new Schema<IImage>(
  {
    avatar: { type: String, required: true },
  },
  { timestamps: true }
);

export const ImageModel = mongoose.model<IImage>("Image", imageSchema);
