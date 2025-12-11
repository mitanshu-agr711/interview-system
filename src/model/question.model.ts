import mongoose, { Schema, Document } from 'mongoose';

export interface IQuestion extends Document {
  topic: string;
  difficulty: 'easy' | 'medium' | 'hard';
  question: string;
  correctAnswer: string;
  createdBy: mongoose.Types.ObjectId;
  workspaceId?: mongoose.Types.ObjectId;
  interviewSessionId?: string;
}

const questionSchema: Schema = new Schema(
  {
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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
    },
    interviewSessionId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export const Question = mongoose.model<IQuestion>('Question', questionSchema);
