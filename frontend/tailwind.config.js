/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0f1117', card: '#1a1d27', border: '#2a2d3a' },
      },
    },
  },
  plugins: [],
}
