import mongoose from "mongoose";

import { CASE_STATUSES, CASE_PRIORITIES } from "@/lib/constants";

export { CASE_STATUSES, CASE_PRIORITIES };
export type { CaseStatus, CasePriority } from "@/lib/constants";

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
