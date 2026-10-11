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
export type AuditResourceType = "SupportIssue" | "SupportReply" | "OAuthCallback";

export interface AuditEventContext {
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

export async function recordAuditEvent(
  event: {
    actorId: string;
    action: AuditAction;
    resourceType: AuditResourceType;
    resourceId: string;
    result: AuditResult;
  },
  context: AuditEventContext = {},
  session?: ClientSession,
) {
  const document = {
    actorId: new mongoose.Types.ObjectId(event.actorId),
    action: event.action,
    resourceType: event.resourceType,
    resourceId: event.resourceId.slice(0, 64),
    result: event.result,
    timestamp: new Date(),
    ip: context.ip?.slice(0, 45),
    userAgent: context.userAgent?.slice(0, 512),
    requestId: context.requestId?.slice(0, 64),
  };

  if (session) {
    await AuditEventModel.create([document], { session });
    return;
  }

  await dbConnect();
  await AuditEventModel.create(document);
}