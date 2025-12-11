import mongoose, { Schema, Document } from 'mongoose';

export interface IAnswer extends Document {
  questionId: mongoose.Types.ObjectId;
  answeredBy: mongoose.Types.ObjectId;
  userAnswer: string;
  isCorrect: boolean;
  shortReason: string;
  correctedAnswer: string;
  interviewSessionId?: string;
  timeTaken?: number;
}

const answerSchema: Schema = new Schema(
  {
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
      required: true,
    },
    answeredBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userAnswer: {
      type: String,
      required: true,
      trim: true,
    },
    isCorrect: {
      type: Boolean,
      required: true,
      default: false,
    },
    shortReason: {
      type: String,
      required: true,
      trim: true,
    },
    correctedAnswer: {
      type: String,
      required: true,
      trim: true,
    },
    interviewSessionId: {
      type: String,
    },
    timeTaken: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const Answer = mongoose.model<IAnswer>('Answer', answerSchema);
