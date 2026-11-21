import {
  CaseIcon,
  CheckCircleIcon,
  FileTextIcon,
  MessageSquareIcon,
  VideoIcon,
} from "@/components/icons";
import { canCreateIssue, canMutate, type UserRole } from "@/lib/roles";

export type LandingCard = {
  icon: typeof FileTextIcon;
  title: string;
  body: string;
  href?: string;
  cta?: string;
};

export type LandingCta = {
  label: string;
  href: string;
  variant: "primary" | "secondary";
};

export type LandingCopy = {
  badge: string;
  /** Headline pieces so one word can keep the brand gradient. */
  lead: string;
  highlight: string;
  rest: string;
  description: string;
  ctas: LandingCta[];
  cards: LandingCard[];
};

export type LandingView = {
  staff: boolean;
  student: boolean;
  copy: LandingCopy;
};

/**
 * Landing copy per audience. The role must come from the server session
 * (`auth()`); anything that is not a known staff or student role falls back to
 * the guest view, so an unexpected value can never surface staff links.
 */
export function copyFor(role: UserRole | null | undefined): LandingView {
  const staff = Boolean(role && canMutate(role));
  const student = !staff && canCreateIssue(role);

  if (staff) {
    return {
      staff,
      student,
      copy: {
        badge: "Hablu Programmer Staff Tool",
        lead: "Support operations,",
        highlight: "answers",
        rest: "and student requests.",
        description:
          "Search the knowledge base, answer student requests, and keep the support queue moving.",
        ctas: [
          { label: "Open dashboard", href: "/dashboard", variant: "primary" },
          { label: "Browse issues", href: "/dashboard/issues", variant: "secondary" },
        ],
        cards: [
          {
            icon: CaseIcon,
            title: "Answer requests",
            body: "Unanswered student requests first, with the full case history in one place.",
            href: "/dashboard/issues",
            cta: "Open issue queue",
          },
          {
            icon: VideoIcon,
            title: "Live support",
            body: "See who is waiting in the room and join during the support schedule.",
            href: "/dashboard/support",
            cta: "Open live support",
          },
          {
            icon: CheckCircleIcon,
            title: "Track delivery",
            body: "Check the support queue and the access requests that still need action.",
            href: "/dashboard",
            cta: "Open dashboard",
          },
        ],
      },
    };
  }

  if (student) {
    return {
      staff,
      student,
      copy: {
        badge: "Hablu Programmer Student Support",
        lead: "Find answers. Get the",
        highlight: "help",
        rest: "you need.",
        description:
          "Search published solutions, track your issues, or access support for your course.",
        ctas: [
          { label: "Browse answers", href: "/dashboard/issues", variant: "primary" },
          { label: "My issues", href: "/dashboard/my-issues", variant: "secondary" },
        ],
        cards: [
          {
            icon: FileTextIcon,
            title: "Published answers",
            body: "Verified fixes and walkthroughs the team has already published.",
            href: "/dashboard/issues",
            cta: "Browse answers",
          },
          {
            icon: MessageSquareIcon,
            title: "My issues",
            body: "Follow the team's reply and any update on what you submitted.",
            href: "/dashboard/my-issues",
            cta: "View my issues",
          },
          {
            icon: VideoIcon,
            title: "Live support",
            body: "See availability and join from your own issue.",
            href: "/dashboard/my-issues",
            cta: "Open my issues",
          },
        ],
      },
    };
  }

  return {
    staff,
    student,
    copy: {
      badge: "Hablu Programmer Support",
      lead: "Find answers from",
      highlight: "Hablu Programmer",
      rest: "Support.",
      description:
        "Browse published solutions from the support library, or sign in to manage your own issues.",
      ctas: [{ label: "Staff Sign In", href: "/login", variant: "primary" }],
      cards: [
        {
          icon: FileTextIcon,
          title: "Published answers",
          body: "Browse curated fixes and walkthroughs published for learners.",
        },
        {
          icon: MessageSquareIcon,
          title: "Always up to date",
          body: "Edits are version-free and instant, so everyone reads the same current answer.",
        },
        {
          icon: CheckCircleIcon,
          title: "Curated answers",
          body: "Internal notes stay private while published answers reach the people who need them.",
        },
      ],
    },
  };
}
