import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        mist: "#eef3ff",
        steel: "#64748b",
      },
      fontFamily: {
        sans: ["'Plus Jakarta Sans'", "'Avenir Next'", "Helvetica", "sans-serif"],
      },
      boxShadow: {
        glass: "0 12px 36px -16px rgba(15, 23, 42, 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
