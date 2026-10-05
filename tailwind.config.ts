import { heroui } from "@heroui/theme";
import type { Config } from "tailwindcss";

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
  plugins: [heroui()],
};
export default config;