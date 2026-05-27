import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf4f2",
          100: "#f9e5e2",
          200: "#f1c7c2",
          300: "#e59c95",
          400: "#d7756c",
          500: "#c95f58",
          600: "#b24541",
          700: "#963735",
          800: "#7d302f",
          900: "#682c2b",
        },
        sport: {
          blue: "#4f7688",
          navy: "#25206f",
          green: "#718271",
          yellow: "#e7c958",
          cream: "#f6f3ee",
          red: "#c95f58",
        },
        ink: {
          900: "#101820",
          800: "#182f38",
          700: "#284a55",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 4px 24px -8px rgba(16, 24, 32, 0.12), 0 1px 2px rgba(16, 24, 32, 0.05)",
        soft: "0 2px 12px -4px rgba(16, 24, 32, 0.10)",
        brand: "0 18px 45px -22px rgba(201, 95, 88, 0.80)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
