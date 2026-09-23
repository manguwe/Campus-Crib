/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // "Trust & tech" visual direction (see knowledge base + README).
        // Deliberately separate from Tailwind's default gray/green/amber/
        // red scales, which stay untouched and keep powering the
        // approved/pending/rejected status badge system - these are only
        // for general UI chrome (nav, buttons, links, headings).
        primary: {
          DEFAULT: '#0B3D62',
          dark: '#082C47',
        },
        accent: {
          DEFAULT: '#0F9D8C',
          dark: '#0C7A6E',
        },
        background: '#EEF2F8',
        ink: '#1E293B',
      },
    },
  },
  plugins: [],
}
