import "server-only";

import type { ClientSession } from "mongoose";
import mongoose from "mongoose";

import { dbConnect } from "@/lib/db";
import {
  AuditEventModel,
  type AUDIT_ACTIONS,
  type AUDIT_RESULTS,
} from "@/models";

export type AuditAction = (typeof AUDIT_ACTIONS)[number];
export type AuditResult = (typeof AUDIT_RESULTS)[number];
export type AuditResourceType = "SupportIssue" | "SupportReply";

export async function recordAuditEvent(
  event: {
    actorId: string;
    action: AuditAction;
    resourceType: AuditResourceType;
    resourceId: string;
    result: AuditResult;
  },
  session?: ClientSession,
) {
  const document = {
    actorId: new mongoose.Types.ObjectId(event.actorId),
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId.slice(0, 64),
    result: event.result,
    timestamp: new Date(),
  };

  if (session) {
    await AuditEventModel.create([document], { session });
    return;
  }

  await dbConnect();
  await AuditEventModel.create(document);
}
