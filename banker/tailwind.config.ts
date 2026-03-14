import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        bank: {
          50: "#eef9f1",
          100: "#daf1e0",
          200: "#b7e2c3",
          300: "#87ca9a",
          400: "#58ad73",
          500: "#2f8f5b",
          600: "#217748",
          700: "#1b613c"
        },
        ink: "#143221",
        border: "#dce5df",
        surface: "#f6f8f7"
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem"
      },
      boxShadow: {
        card: "0 10px 30px rgba(20, 50, 33, 0.05)"
      }
    }
  },
  plugins: []
};

export default config;
