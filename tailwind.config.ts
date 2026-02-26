import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#101014",
        panel: "#18181b",
        panelSoft: "#1f1f23",
        border: "#2a2a30",
        text: "#f1f1f2",
        muted: "#a6a6ab",
        brand: "#c8a35a",
        danger: "#f87171"
      },
      fontFamily: {
        serif: ["var(--font-display)"],
        sans: ["var(--font-body)"]
      }
    }
  },
  plugins: []
};

export default config;
