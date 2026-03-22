import mongoose, { Schema, Document } from 'mongoose';

export interface IAnswer extends Document {
  attemptId: mongoose.Types.ObjectId;
  questionId: mongoose.Types.ObjectId;
  userAnswer: string;
  isCorrect: boolean;
  shortReason: string;
  correctedAnswer: string;
  timeTaken?: number;
}

const answerSchema: Schema = new Schema(
  {
     attemptId: {
      type: Schema.Types.ObjectId,
      ref: 'InterviewAttempt',
      required: true,
    }, 
    questionId: {
      type: Schema.Types.ObjectId,
      ref: 'Question',
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
    timeTaken: {
      type: Number,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);


answerSchema.index({ attemptId: 1 });
answerSchema.index(
  { attemptId: 1, questionId: 1 },
  { unique: true }
);

;


export const Answer = mongoose.model<IAnswer>('Answer', answerSchema);
