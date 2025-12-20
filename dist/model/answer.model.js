import mongoose, { Schema } from 'mongoose';
const answerSchema = new Schema({
    interviewId: {
        type: Schema.Types.ObjectId,
        ref: 'Interview',
        required: true,
    },
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
    timeTaken: {
        type: Number,
        min: 0,
    },
}, {
    timestamps: true,
});
// Indexes for faster queries
answerSchema.index({ interviewId: 1 });
answerSchema.index({ questionId: 1 });
answerSchema.index({ answeredBy: 1 });
answerSchema.index({ interviewId: 1, answeredBy: 1 });
export const Answer = mongoose.model('Answer', answerSchema);
