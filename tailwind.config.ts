import { heroui } from "@heroui/theme";
import type { Config } from "tailwindcss";

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

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        // Set by next/font in app/layout.tsx; falls back to the system stack if
        // the variable is ever missing, so text is never rendered in a
        // fontless state.
        sans: ["var(--font-bangla)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [
    heroui({
      themes: {
        light: { colors: { primary: cyan } },
        dark: { colors: { primary: cyan } },
      },
    }),
  ],
};
export default config;
