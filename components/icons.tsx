import type { FC, SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & { size?: number };

/**
 * Stroke-based nav icons that inherit `currentColor`, so the sidebar's active
 * state (`text-cyan-500`) recolors both label and icon — unlike the main
 * frontend's flat-color art, which stays fixed once active.
 */
const base = (size = 22) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const DashboardIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </svg>
);

export const CaseIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 9h8" />
    <path d="M8 13h5" />
  </svg>
);

export const SearchIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

export const ChevronDownIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
