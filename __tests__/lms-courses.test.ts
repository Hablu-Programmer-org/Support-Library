import { describe, expect, it } from "vitest";

import { pickStudentCourses } from "@/lib/lms-courses";

const names = new Map([["jfwd", "Journey Of Frontend Web Development"]]);

describe("pickStudentCourses", () => {
  it("shows one row per course even when the student re-enrolled", () => {
    const courses = pickStudentCourses(
      [
        { courseSlug: "jfwd", batchNo: 1, status: "completed" },
        { courseSlug: "jfwd", batchNo: 2, status: "running" },
      ],
      names,
    );

    expect(courses).toHaveLength(1);
    expect(courses[0]).toMatchObject({ slug: "jfwd", batchNo: 2, status: "running" });
  });

  it("prefers the running enrolment over a later completed one", () => {
    const courses = pickStudentCourses(
      [
        { courseSlug: "jfwd", batchNo: 4, status: "running" },
        { courseSlug: "jfwd", batchNo: 5, status: "completed" },
      ],
      names,
    );

    expect(courses[0].batchNo).toBe(4);
    expect(courses[0].status).toBe("running");
  });

  it("takes the highest batch when both enrolments are running", () => {
    const courses = pickStudentCourses(
      [
        { courseSlug: "jfwd", batchNo: 1, status: "running" },
        { courseSlug: "jfwd", batchNo: 3, status: "running" },
      ],
      names,
    );

    expect(courses[0].batchNo).toBe(3);
  });

  it("uses the course name and falls back to the slug", () => {
    const courses = pickStudentCourses(
      [
        { courseSlug: "jfwd", batchNo: 2, status: "running" },
        { courseSlug: "ai-powered-full-stack-web-development", batchNo: 1, status: "running" },
      ],
      names,
    );

    expect(courses[0]).toMatchObject({ slug: "ai-powered-full-stack-web-development", name: "ai-powered-full-stack-web-development" });
    expect(courses[1]).toMatchObject({ slug: "jfwd", name: "Journey Of Frontend Web Development" });
  });

  it("drops rows without a slug and batches that are not positive", () => {
    const courses = pickStudentCourses(
      [
        { courseSlug: "", batchNo: 2 },
        { courseSlug: "jfwd", batchNo: "0" },
        { batchNo: 1 },
      ],
      names,
    );

    expect(courses).toHaveLength(1);
    expect(courses[0].batchNo).toBe(0);
  });
});
