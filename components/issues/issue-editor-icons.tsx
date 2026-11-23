import type { FC } from "react";

import type { IconSvgProps } from "@/components/icons";

/** Toolbar icons, same stroke style as components/icons; only the editor chunk imports them. */
const base = (size = 18) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const BoldIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M7 5h6a3.5 3.5 0 0 1 0 7H7z" />
    <path d="M7 12h7a3.5 3.5 0 0 1 0 7H7z" />
  </svg>
);

export const ItalicIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M19 5h-8M13 19H5M15 5 9 19" />
  </svg>
);

export const CodeIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="m9 8-5 4 5 4M15 8l5 4-5 4" />
  </svg>
);

export const CodeBlockIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <path d="m10 10-2.5 2 2.5 2M14 10l2.5 2-2.5 2" />
  </svg>
);

export const BulletListIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M9 6h11M9 12h11M9 18h11" />
    <circle cx="4.5" cy="6" r="0.6" fill="currentColor" />
    <circle cx="4.5" cy="12" r="0.6" fill="currentColor" />
    <circle cx="4.5" cy="18" r="0.6" fill="currentColor" />
  </svg>
);

export const NumberedListIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M10 6h10M10 12h10M10 18h10" />
    <path d="M4 5h1.5v4M4 9h3" strokeWidth={1.6} />
    <path d="M4 15.2c.3-.7 2.8-.9 2.8.5 0 1-2.8 1.8-2.8 3.3h3" strokeWidth={1.6} />
  </svg>
);

export const HeadingIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M6 4v16M18 4v16M6 12h12" />
  </svg>
);

export const LinkIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </svg>
);

export const UndoIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </svg>
);

export const RedoIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </svg>
);
