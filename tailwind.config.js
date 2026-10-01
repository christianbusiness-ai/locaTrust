/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#0038FF',
          600: '#0B44ED',
          700: '#002ACC',
          800: '#001E99',
          900: '#001466',
        },
        gold: {
          400: '#F59E0B',
          500: '#D4AF37',
          600: '#B89628',
        },
        surface: {
          light: '#FFFFFF',
          soft: '#F8FAFC',
          border: '#E2E8F0',
          dark: '#0F172A',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 10px rgba(0, 0, 0, 0.04), 0 1px 3px rgba(0, 0, 0, 0.02)',
        elevated: '0 10px 30px rgba(0, 56, 255, 0.08), 0 4px 12px rgba(0, 0, 0, 0.05)',
      }
    },
  },
  plugins: [],
}
