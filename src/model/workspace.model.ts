import mongoose, { Schema, Document } from "mongoose";
export interface IWorkspace extends Document {
  title: string;
  Interviews: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
}
const WorkspaceSchema: Schema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      default: "Untitled Workspace",
    },
    Interviews: [{ type: Schema.Types.ObjectId, ref: "Interview" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  {
    timestamps: true,
  }
);
export const Workspace = mongoose.model<IWorkspace>(
  "Workspace",
  WorkspaceSchema
);

