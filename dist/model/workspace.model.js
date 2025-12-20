import mongoose, { Schema } from "mongoose";
const WorkspaceSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        default: "Untitled Workspace",
    },
    Interviews: [{ type: Schema.Types.ObjectId, ref: "Interview" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
}, {
    timestamps: true,
});
export const Workspace = mongoose.model("Workspace", WorkspaceSchema);
