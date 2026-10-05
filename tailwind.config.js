/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          pink: '#FF6EA7',
          pinkLight: '#FFF0F5',
          pinkDark: '#E0478B',
          accent: '#A78BFA',
        }
      },
      fontFamily: {
        display: ['"Fredoka"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
