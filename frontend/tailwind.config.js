/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        atm: {
          bg: '#FBF8F3',
          card: '#FFFFFF',
          ink: '#2E2A24',
          muted: '#7A7567',
          accent: '#E07856',
        },
      },
    },
  },
  plugins: [],
}
