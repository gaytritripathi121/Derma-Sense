import mongoose from 'mongoose';
import { CLASS_CODES } from '../config/constants.js';

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true }
);

const sessionSchema = new Schema(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    rememberMe: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  { timestamps: true }
);

const screeningHistorySchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reportId: {
      type: String,
      required: true,
      trim: true,
    },
    predictedCategory: {
      type: String,
      enum: CLASS_CODES,
      required: true,
    },
    fullCategoryName: {
      type: String,
      required: true,
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
    },
    confidencePercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    screeningStatus: {
      type: String,
      enum: ['LOW_CONFIDENCE', 'STANDARD_CONFIDENCE'],
      required: true,
    },
    isLowConfidence: {
      type: Boolean,
      required: true,
    },
    statusLabel: {
      type: String,
      default: '',
    },
    confidenceMessage: {
      type: String,
      default: '',
    },
    topThree: [
      {
        _id: false,
        code: String,
        fullName: String,
        percentage: Number,
      },
    ],
    allProbabilities: [
      {
        _id: false,
        code: String,
        fullName: String,
        probability: Number,
        percentage: Number,
      },
    ],
    contextualStatus: {
      type: String,
      default: '',
    },
    contextualStatusLabel: {
      type: String,
      default: '',
    },
    contextualRecommendation: {
      type: String,
      default: '',
    },
    triggeredFlags: [
      {
        _id: false,
        ruleId: String,
        severity: String,
        title: String,
        explanation: String,
        suggestedNextStep: String,
      },
    ],
    imageQualitySummary: {
      _id: false,
      width: Number,
      height: Number,
      sharpnessScore: Number,
      meanBrightness: Number,
      warnings: [String],
    },
    modelVersion: {
      type: String,
      default: '',
    },
    analyzedAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

screeningHistorySchema.index({ userId: 1, createdAt: -1 });
screeningHistorySchema.index({ userId: 1, reportId: 1 }, { unique: true });

export const User = mongoose.models.User || mongoose.model('User', userSchema);
export const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
export const ScreeningHistory =
  mongoose.models.ScreeningHistory || mongoose.model('ScreeningHistory', screeningHistorySchema);
