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

export const StudentIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const CaseIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <path d="M8 9h8" />
    <path d="M8 13h5" />
  </svg>
);

export const SolutionIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    <path d="M9 7h6" />
    <path d="M9 11h4" />
  </svg>
);

export const SearchIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </svg>
);

export const AnalyticsIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M3 3v18h18" />
    <path d="M7 15l4-5 3.5 3.5L20 7" />
  </svg>
);

export const AdminIcon: FC<IconSvgProps> = ({ size, ...props }) => (
  <svg {...base(size)} {...props}>
    <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
