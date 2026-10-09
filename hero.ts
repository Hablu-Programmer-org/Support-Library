import { heroui } from "@heroui/theme";

/**
 * Cyan palette (Tailwind's `cyan`) as HeroUI's `primary`, so HeroUI
 * buttons/badges/links match the main frontend's cyan accent instead of
 * HeroUI's default indigo-blue.
 */
const cyan = {
  50: "#ecfeff",
  100: "#cffafe",
  200: "#a5f3fc",
  300: "#67e8f9",
  400: "#22d3ee",
  500: "#06b6d4",
  600: "#0891b2",
  700: "#0e7490",
  800: "#155e75",
  900: "#164e63",
  950: "#083344",
  DEFAULT: "#06b6d4",
  foreground: "#ffffff",
};

/**
 * Tailwind's slate as HeroUI's neutral family, replacing the default zinc
 * scale (#18181b/#27272a/...) so Cards/panels/chips sit on slate like the
 * rest of the app. HeroUI inverts the neutral scale in dark mode (50 = darkest),
 * so slateScaleDark is intentionally reversed.
 */
const slateScale = {
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  400: "#94a3b8",
  500: "#64748b",
  600: "#475569",
  700: "#334155",
  800: "#1e293b",
  900: "#0f172a",
  DEFAULT: "#cbd5e1",
  foreground: "#0f172a",
};

const slateScaleDark = {
  50: "#0f172a",
  100: "#1e293b",
  200: "#334155",
  300: "#475569",
  400: "#64748b",
  500: "#94a3b8",
  600: "#cbd5e1",
  700: "#e2e8f0",
  800: "#f1f5f9",
  900: "#f8fafc",
  DEFAULT: "#334155",
  foreground: "#ffffff",
};

/** foreground scale only (no nested `foreground` key on the foreground color itself). */
const slateForeground = {
  50: slateScale[50],
  100: slateScale[100],
  200: slateScale[200],
  300: slateScale[300],
  400: slateScale[400],
  500: slateScale[500],
  600: slateScale[600],
  700: slateScale[700],
  800: slateScale[800],
  900: slateScale[900],
  DEFAULT: "#0f172a",
};

const slateForegroundDark = {
  50: slateScaleDark[50],
  100: slateScaleDark[100],
  200: slateScaleDark[200],
  300: slateScaleDark[300],
  400: slateScaleDark[400],
  500: slateScaleDark[500],
  600: slateScaleDark[600],
  700: slateScaleDark[700],
  800: slateScaleDark[800],
  900: slateScaleDark[900],
  DEFAULT: "#f1f5f9",
};

/**
 * HeroUI v2 plugin, loaded from `app/globals.css` via `@plugin`. Tailwind v4
 * does not auto-scan node_modules, so `@source` points at the HeroUI theme
 * dist for the component class names.
 */
export default heroui({
  themes: {
    light: {
      colors: {
        primary: cyan,
        focus: "#06b6d4",
        foreground: slateForeground,
        default: slateScale,
        content2: "#f1f5f9",
        content3: "#e2e8f0",
        content4: "#cbd5e1",
      },
    },
    dark: {
      colors: {
        primary: cyan,
        focus: "#06b6d4",
        background: "#020617",
        foreground: slateForegroundDark,
        default: slateScaleDark,
        content1: "#0f172a",
        content2: "#1e293b",
        content3: "#334155",
        content4: "#475569",
      },
    },
  },
});
