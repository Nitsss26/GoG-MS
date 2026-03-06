/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#10b981",
          foreground: "#022c22",
        },
        background: "#0a0a0a",
        foreground: "#e4e4e7",
        surface: {
          DEFAULT: "#111111",
          light: "#161616",
        },
        border: "#1e1e1e",
        muted: {
          DEFAULT: "#71717a",
          foreground: "#a1a1aa",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
