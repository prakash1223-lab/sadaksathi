/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fef3f2',
          100: '#fde8e7',
          500: '#e53e3e',
          600: '#c53030',
          700: '#9b2c2c',
        }
      }
    },
  },
  plugins: [],
}
