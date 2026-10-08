import mongoose from "mongoose";

export const CASE_STATUSES = ["OPEN", "SOLVED", "PENDING", "FOLLOW_UP", "ARCHIVED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const externalFileLinkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    type: { type: String, trim: true, maxlength: 40, default: null },
    note: { type: String, trim: true, maxlength: 300, default: null },
  },
  { _id: false },
);

export const videoLinkSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    url: { type: String, required: true, trim: true, maxlength: 2048 },
    timestamp: { type: String, trim: true, maxlength: 12, default: null },
    summary: { type: String, trim: true, maxlength: 500, default: null },
  },
  { _id: false },
);
