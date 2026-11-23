import mongoose from "mongoose";

import { CASE_STATUSES, CASE_PRIORITIES, ISSUE_VISIBILITIES } from "@/lib/constants";
import { UPLOAD_IMAGE_MIME_TYPES, UPLOAD_MAX_BYTES_CEILING } from "@/lib/uploads/limits";

export { CASE_STATUSES, CASE_PRIORITIES, ISSUE_VISIBILITIES };
export type { CaseStatus, CasePriority, IssueVisibility } from "@/lib/constants";

/**
 * An uploaded image stored in the object store.
 *
 * `_id` is kept (unlike the link subdocuments) because it is the only public
 * handle for the file: `/api/attachments/<_id>` resolves and authorizes it, so
 * the object `key` never has to leave the server.
 */
export const uploadAttachmentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true, maxlength: 512 },
    originalName: { type: String, required: true, trim: true, maxlength: 200 },
    mimeType: { type: String, required: true, trim: true, enum: [...UPLOAD_IMAGE_MIME_TYPES] },
    byteSize: { type: Number, required: true, min: 1, max: UPLOAD_MAX_BYTES_CEILING },
    width: { type: Number, default: null, min: 1 },
    height: { type: Number, default: null, min: 1 },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    createdAt: { type: Date, required: true, default: Date.now },
  },
  { _id: true },
);
