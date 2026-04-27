import mongoose, { Schema } from "mongoose";
const InterviewAttemptSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    interviewId: {
        type: Schema.Types.ObjectId,
        ref: "Interview",
        required: true,
    },
    status: {
        type: String,
        enum: ["in-progress", "completed"],
        default: "in-progress",
    },
    startedAt: Date,
    completedAt: Date,
    totalQuestions: {
        type: Number,
        default: 0,
    },
    answeredQuestions: {
        type: Number,
        default: 0,
    },
    correctAnswers: {
        type: Number,
        default: 0,
    },
    wrongAnswers: {
        type: Number,
        default: 0,
    },
    scorePercentage: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });
InterviewAttemptSchema.index({ userId: 1 });
InterviewAttemptSchema.index({ interviewId: 1 });
InterviewAttemptSchema.index({ userId: 1, interviewId: 1 });
export const InterviewAttempt = mongoose.model("InterviewAttempt", InterviewAttemptSchema);
