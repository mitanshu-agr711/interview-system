import mongoose, { Schema, Document } from "mongoose";
export interface IWorkspace extends Document {
  title: string;
  Interviews: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;


  // 🔥 NEW
  isShared: boolean;
  shareToken: string | null;
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
   // 🔥 ADD THIS
    isShared: {
      type: Boolean,
      default: false,
    },
    shareToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// indexes
WorkspaceSchema.index({ createdBy: 1 });
WorkspaceSchema.index({ shareToken: 1 });

export const Workspace = mongoose.model<IWorkspace>(
  "Workspace",
  WorkspaceSchema
);

