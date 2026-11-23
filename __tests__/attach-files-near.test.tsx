import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AttachmentField, attachFilesNear } from "@/components/shared/attachment-field";

beforeEach(() => {
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
});

const png = () => new File([new Uint8Array(8)], "shot.png", { type: "image/png", lastModified: 1 });

/** Staff IssueForm shape: the issue's field and the answer's field in one form. */
function TwoFields() {
  return (
    <form>
      <section>
        <div data-testid="question-source" />
        <AttachmentField name="uploads" label="Issue images" />
      </section>
      <section>
        <div data-testid="answer-source" />
        <AttachmentField name="solutionUploads" label="Answer images" />
      </section>
    </form>
  );
}

/** jsdom has no DataTransfer, so count the previews inside each section. */
const count = (container: HTMLElement, name: string) =>
  container.querySelector(`input[name="${name}"]`)!.closest("section")!.querySelectorAll("img").length;

describe("attachFilesNear", () => {
  it("sends files to the field nearest the source, not just the first in the form", () => {
    const { container, getByTestId } = render(<TwoFields />);

    act(() => {
      attachFilesNear(getByTestId("answer-source"), [png()]);
    });
    expect(count(container, "solutionUploads")).toBe(1);
    expect(count(container, "uploads")).toBe(0);

    act(() => {
      attachFilesNear(getByTestId("question-source"), [png()]);
    });
    expect(count(container, "uploads")).toBe(1);
  });
});
