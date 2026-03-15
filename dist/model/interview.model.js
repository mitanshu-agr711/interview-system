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
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed'],
        default: 'pending',
    },
    startedAt: {
        type: Date,
    },
    completedAt: {
        type: Date,
    },
    totalQuestions: {
        type: Number,
        default: 0,
        min: 0,
    },
    answeredQuestions: {
        type: Number,
        default: 0,
        min: 0,
    },
    correctAnswers: {
        type: Number,
        default: 0,
        min: 0,
    },
    wrongAnswers: {
        type: Number,
        default: 0,
        min: 0,
    },
    scorePercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
    },
}, {
    timestamps: true,
});
// Index for faster queries
interviewSchema.index({ workspaceId: 1, createdBy: 1 });
interviewSchema.index({ createdBy: 1, status: 1 });
interviewSchema.index({ createdAt: -1 });
// Method to update analytics
interviewSchema.methods.updateAnalytics = async function () {
    const Question = mongoose.model('Question');
    const Answer = mongoose.model('Answer');
    const questions = await Question.countDocuments({ interviewId: this._id });
    const answers = await Answer.find({ interviewId: this._id });
    this.totalQuestions = questions;
    this.answeredQuestions = answers.length;
    this.correctAnswers = answers.filter(a => a.isCorrect).length;
    this.wrongAnswers = answers.filter(a => !a.isCorrect).length;
    this.scorePercentage = questions > 0
        ? Math.round((this.correctAnswers / questions) * 100)
        : 0;
    return this.save();
};
export const Interview = mongoose.model('Interview', interviewSchema);
