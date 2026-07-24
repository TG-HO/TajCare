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
          50: '#f0f4f9',
          100: '#d9e2ec',
          500: '#1e3a8a', // Taj Navy Primary
          600: '#0f172a', // Deep Navy / Slate 900
          700: '#0a0f1d',
        },
        navy: {
          DEFAULT: '#0F172A',
          light: '#1E293B',
        },
        surface: {
          DEFAULT: '#F8FAFC', // Slate 50 Light theme background
          card: '#FFFFFF',
          border: '#E2E8F0', // Slate 200 crisp borders
        }
      },
    },
  },
  plugins: [],
};
export default config;
