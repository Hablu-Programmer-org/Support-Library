import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StatusBadge, statusLabelFor } from "@/components/issues/status-badge";

describe("status label by viewer", () => {
  it("tells staff and readers the case waits on the student", () => {
    expect(statusLabelFor("AWAITING_STUDENT")).toBe("Waiting on student");
    render(<StatusBadge status="AWAITING_STUDENT" />);
    expect(screen.getByText("Waiting on student")).toBeTruthy();
  });

  it("asks the owning student for their reply", () => {
    expect(statusLabelFor("AWAITING_STUDENT", "owner")).toBe("Needs your reply");
  });

  it("keeps other statuses the same for every viewer", () => {
    expect(statusLabelFor("OPEN", "owner")).toBe("Open");
    expect(statusLabelFor("SOLVED")).toBe("Solved");
  });
});
