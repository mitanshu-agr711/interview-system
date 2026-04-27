import mongoose, { Schema, Document } from "mongoose";

export interface IInterviewAttempt extends Document {
  userId: mongoose.Types.ObjectId;
  interviewId: mongoose.Types.ObjectId;
  attemptId: string;

  status: "in-progress" | "completed";

  startedAt?: Date;
  completedAt?: Date;

  totalQuestions: number;
  answeredQuestions: number;
  correctAnswers: number;
  wrongAnswers: number;
  scorePercentage: number;
}

const InterviewAttemptSchema: Schema = new Schema(
  {
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
  },
  { timestamps: true }
);


// Prevent duplicate in-progress attempts per user/interview
InterviewAttemptSchema.index({ userId: 1, interviewId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'in-progress' } });

export const InterviewAttempt = mongoose.model<IInterviewAttempt>(
  "InterviewAttempt",
  InterviewAttemptSchema
);