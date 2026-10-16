/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: { 50: '#effaf1', 100: '#dcf4e1', 500: '#16a34a', 700: '#14532d', 800: '#12452a', 900: '#0e3823' },
        flame: '#ea580c',
      },
      fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'] },
      boxShadow: { card: '0 12px 32px rgba(20, 83, 45, 0.07)' },
      borderRadius: { '4xl': '2rem' },
    },
  },
  plugins: [],
};
