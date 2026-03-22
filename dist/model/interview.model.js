import mongoose, { Schema } from 'mongoose';
const interviewSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        default: 'Untitled Interview',
    },
    description: {
        type: String,
        trim: true,
    },
    topic: {
        type: String,
        required: true,
        trim: true,
    },
    workspaceId: {
        type: Schema.Types.ObjectId,
        ref: 'Workspace',
        required: true,
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    totalQuestions: {
        type: Number,
        default: 0,
        min: 0,
    },
}, {
    timestamps: true,
});
// indexes
interviewSchema.index({ workspaceId: 1 });
interviewSchema.index({ createdBy: 1 });
interviewSchema.index({ createdAt: -1 });
export const Interview = mongoose.model('Interview', interviewSchema);
