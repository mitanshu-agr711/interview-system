import mongoose, { Schema } from "mongoose";
const InterviewAttemptSchema = new Schema({
    attemptId: {
        type: String,
        required: true,
        unique: true,
    },
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
// Prevent duplicate in-progress attempts per user/interview
InterviewAttemptSchema.index({ userId: 1, interviewId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'in-progress' } });
export const InterviewAttempt = mongoose.model("InterviewAttempt", InterviewAttemptSchema);
