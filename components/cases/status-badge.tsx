import { Chip } from "@heroui/react";

import type { CaseStatus } from "@/models";

const statusLabel: Record<CaseStatus, string> = {
  OPEN: "Open",
  SOLVED: "Solved",
  PENDING: "Pending",
  FOLLOW_UP: "Follow-up",
  ARCHIVED: "Archived",
};

const statusColor: Record<CaseStatus, "default" | "primary" | "success" | "warning" | "secondary"> = {
  OPEN: "primary",
  SOLVED: "success",
  PENDING: "warning",
  FOLLOW_UP: "secondary",
  ARCHIVED: "default",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <Chip color={statusColor[status]} size="sm" variant="flat">
      {statusLabel[status]}
    </Chip>
  );
}
