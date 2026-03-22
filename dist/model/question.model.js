import mongoose, { Schema } from 'mongoose';
const questionSchema = new Schema({
    topic: {
        type: String,
        required: true,
        trim: true,
    },
    question: {
        type: String,
        required: true,
        trim: true,
    },
    correctAnswer: {
        type: String,
        required: true,
        trim: true,
    },
    interviewId: {
        type: Schema.Types.ObjectId,
        ref: 'Interview',
        required: true,
    },
    // workspaceId: {
    //   type: Schema.Types.ObjectId,
    //   ref: 'Workspace',
    //   required: true,
    // },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
}, {
    timestamps: true,
});
questionSchema.index({ interviewId: 1 });
// Indexes for faster queries
// questionSchema.index({ interviewId: 1 });
// questionSchema.index({ workspaceId: 1 });
// questionSchema.index({ createdBy: 1 });
export const Question = mongoose.model('Question', questionSchema);
