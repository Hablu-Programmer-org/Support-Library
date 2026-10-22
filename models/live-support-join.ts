import mongoose, { type InferSchemaType, type Model } from "mongoose";

/**
 * One student walking into the live support room with one request.
 *
 * The row exists so staff can see who is waiting and what for (the room itself
 * is external), and it is the audit-grade record of the join. `dayKey` is the
 * Asia/Dhaka calendar day and `shift` the open window, which together make a
 * join idempotent: a double submit cannot put the same student in the queue
 * twice for the same shift, while a genuine second visit that evening is a new
 * row.
 */

export const LIVE_SUPPORT_SHIFTS = ["morning", "night"] as const;
export type LiveSupportShiftName = (typeof LIVE_SUPPORT_SHIFTS)[number];

const liveSupportJoinSchema = new mongoose.Schema(
  {
    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "support-issue",
      required: true,
    },
    /** The local `staff-users` row that joined (the authenticated actor). */
    studentUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    /** hp-v2 user id carried over from the request, when it had one. */
    lmsUserId: { type: String, default: null },
    shift: { type: String, enum: LIVE_SUPPORT_SHIFTS, required: true },
    /** `YYYY-MM-DD` in Asia/Dhaka. */
    dayKey: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    joinedAt: { type: Date, required: true, default: Date.now },
  },
  {
    collection: "live-support-joins",
    versionKey: false,
  },
);

// Idempotency: one join per request per shift per support day. Shift-scoped so a
// student who comes back in the evening appears under the night shift, while a
// double submit inside one shift still collapses to a single row.
liveSupportJoinSchema.index(
  { issueId: 1, dayKey: 1, shift: 1 },
  { unique: true, name: "live-support-joins-issue-day-shift-unique" },
);

// The queue only ever reads one day, newest first.
liveSupportJoinSchema.index(
  { dayKey: 1, joinedAt: -1 },
  { name: "live-support-joins-day-joined" },
);

// Joins are operational data, not history: purge them after half a year.
liveSupportJoinSchema.index(
  { joinedAt: 1 },
  { name: "live-support-joins-purge-ttl", expireAfterSeconds: 60 * 60 * 24 * 180 },
);

export type LiveSupportJoinDocument = InferSchemaType<typeof liveSupportJoinSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const LiveSupportJoinModel: Model<LiveSupportJoinDocument> =
  (mongoose.models["live-support-join"] as Model<LiveSupportJoinDocument>) ??
  mongoose.model<LiveSupportJoinDocument>("live-support-join", liveSupportJoinSchema);
