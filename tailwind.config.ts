import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f7f8",
          100: "#eeeef0",
          200: "#d9d9de",
          300: "#b6b6c0",
          400: "#8c8c9a",
          500: "#6b6b7a",
          600: "#54545f",
          700: "#43434c",
          800: "#2b2b31",
          900: "#18181b",
          950: "#0c0c0e",
        },
        // Turquesa/verde-azulado del logo de ZoriaBooking (antes era un
        // morado genérico de placeholder).
        brand: {
          50: "#effffb",
          100: "#d2fdf2",
          200: "#a8f7e3",
          300: "#71ecce",
          400: "#3fdcb9",
          500: "#1cc7a3",
          600: "#12a687",
          700: "#12836e",
          800: "#146859",
          900: "#13544a",
          950: "#062f29",
        },
        surface: "#fbfbfa",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(0 0 0 / 0.04), 0 8px 24px -8px rgb(0 0 0 / 0.08)",
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out",
        "scale-in": "scale-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
