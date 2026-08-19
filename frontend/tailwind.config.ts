import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#ecfdf9",
          100: "#d1faf0",
          200: "#a4f4e2",
          300: "#6dead0",
          400: "#3ad9bc",
          500: "#14b8a6",
          600: "#0d9488",
          700: "#0f766e",
          800: "#115e59",
          900: "#134e4a",
        },
        accent: {
          50: "#fff5f2",
          100: "#ffe4dc",
          200: "#ffc4b3",
          300: "#ff9d81",
          400: "#fb7654",
          500: "#f4552f",
          600: "#dd3d1a",
          700: "#b82f14",
        },
      },
    },
  },
  plugins: [],
};

export default config;
