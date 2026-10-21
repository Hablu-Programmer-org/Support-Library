import "server-only";

import mongoose from "mongoose";

import {
  caseRefFor,
  dayKeyInDhaka,
} from "@/lib/config/live-support";
import type { CaseStatus } from "@/lib/constants";
import { dbConnect } from "@/lib/db";
import {
  LiveSupportJoinModel,
  SupportIssueModel,
  UserModel,
  type LiveSupportShiftName,
} from "@/models";

/** The queue is a "who is waiting right now" view, so it stays bounded. */
const MAX_QUEUE_ROWS = 200;

const DUPLICATE_KEY = 11000;

const isDuplicateKeyError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: number }).code === DUPLICATE_KEY;

export type RecordLiveSupportJoinInput = {
  issueId: string;
  studentUserId: string;
  lmsUserId?: string | null;
  shift: LiveSupportShiftName;
  /** Injectable so the open/closed matrix is testable without touching clocks. */
  now?: Date;
};

export type LiveSupportJoinRecord = {
  dayKey: string;
  joinedAt: Date;
  /** False when this request was already recorded for the same support day. */
  created: boolean;
};

/**
 * Record that a student took a request into the room, idempotently.
 *
 * The unique `{ issueId, dayKey, shift }` index is the guard: a double submit
 * inside one shift (or two tabs) keeps the first row and returns it, so the
 * staff queue never shows the same student twice for that shift and an
 * out-of-order retry cannot create a second entry. A later shift in the same day
 * is a new row on purpose.
 */
export async function recordLiveSupportJoin(
  input: RecordLiveSupportJoinInput,
): Promise<LiveSupportJoinRecord> {
  const now = input.now ?? new Date();
  const dayKey = dayKeyInDhaka(now);
  const issueId = new mongoose.Types.ObjectId(input.issueId);
  const studentUserId = new mongoose.Types.ObjectId(input.studentUserId);

  await dbConnect();

  let created = true;
  try {
    await LiveSupportJoinModel.findOneAndUpdate(
      { issueId, dayKey, shift: input.shift },
      {
        $setOnInsert: {
          issueId,
          studentUserId,
          lmsUserId: input.lmsUserId ?? null,
          shift: input.shift,
          dayKey,
          joinedAt: now,
        },
      },
      { upsert: true, setDefaultsOnInsert: true },
    ).lean();
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    // A concurrent submit won the insert; the existing row is the answer.
    created = false;
  }

  const join = await LiveSupportJoinModel.findOne({
    issueId,
    dayKey,
    shift: input.shift,
  }).lean();
  if (!join) throw new Error("Live support join could not be recorded");

  // Deliberately not `updatedAt`: staff edits and publication compare against
  // the revision they rendered, so a join must not invalidate their view.
  await SupportIssueModel.updateOne(
    { _id: issueId, deletedAt: null },
    { $set: { lastLiveSupportAt: now } },
    { timestamps: false },
  );

  return { dayKey, joinedAt: join.joinedAt, created };
}

/** Who is waiting in the room right now (staff dashboard / queue badge). */
export async function countLiveSupportJoins(dayKey: string): Promise<number> {
  await dbConnect();
  return LiveSupportJoinModel.countDocuments({ dayKey });
}

/** Issue ids with a join today, for a "waiting" marker in staff lists. */
export async function listJoinIssueIdsForDay(dayKey: string): Promise<string[]> {
  await dbConnect();
  const rows = await LiveSupportJoinModel.find({ dayKey }, "issueId").limit(MAX_QUEUE_ROWS).lean();
  return [...new Set(rows.map((row) => String(row.issueId)))];
}

export type LiveSupportQueueEntry = {
  id: string;
  joinedAt: Date;
  shift: LiveSupportShiftName;
  caseRef: string;
  issueId: string;
  issueTitle: string;
  issueStatus: CaseStatus | null;
  issueDeleted: boolean;
  studentName: string;
  studentEmail: string | null;
};

/**
 * Who is waiting in the room today, newest first.
 *
 * Staff-only by call site (`/dashboard/live-support`). It exposes the student's
 * name and email because that page is already staff-gated and the same data is
 * visible in the internal case view; nothing else leaks.
 */
export async function listLiveSupportQueue(dayKey: string): Promise<LiveSupportQueueEntry[]> {
  await dbConnect();

  const joins = await LiveSupportJoinModel.find({ dayKey })
    .sort({ joinedAt: -1 })
    .limit(MAX_QUEUE_ROWS)
    .lean();
  if (joins.length === 0) return [];

  const issueIds = [...new Set(joins.map((join) => String(join.issueId)))];
  const userIds = [...new Set(joins.map((join) => String(join.studentUserId)))];

  const [issues, users] = await Promise.all([
    SupportIssueModel.find({ _id: { $in: issueIds } }, "title status deletedAt").lean(),
    UserModel.find({ _id: { $in: userIds } }, "name email").lean(),
  ]);

  const issueById = new Map(issues.map((issue) => [String(issue._id), issue]));
  const userById = new Map(users.map((user) => [String(user._id), user]));

  return joins.map((join) => {
    const issue = issueById.get(String(join.issueId));
    const user = userById.get(String(join.studentUserId));

    return {
      id: String(join._id),
      joinedAt: join.joinedAt,
      shift: join.shift,
      caseRef: caseRefFor(String(join.issueId)),
      issueId: String(join.issueId),
      issueTitle: issue?.title ?? "Request removed",
      issueStatus: issue ? (issue.status as CaseStatus) : null,
      issueDeleted: Boolean(issue?.deletedAt),
      studentName: user?.name ?? "Unknown student",
      studentEmail: user?.email ?? null,
    };
  });
}
