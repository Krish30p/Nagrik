/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0F766E', // teal-700
          hover: '#0D5E58',
          light: '#F0FDFA',
        },
        secondary: {
          DEFAULT: '#14B8A6', // teal-500
          hover: '#0D9488',
        },
        background: {
          DEFAULT: '#F8FAFC', // slate-50
          dark: '#0F172A', // slate-900 (for dark mode or cards)
        },
        danger: {
          DEFAULT: '#DC2626', // red-600
          light: '#FEF2F2',
        },
        success: {
          DEFAULT: '#16A34A', // green-600
          light: '#F0FDF4',
        },
        warning: {
          DEFAULT: '#D97706', // amber-600
          light: '#FEF3C7',
        },
        info: {
          DEFAULT: '#2563EB', // blue-600
          light: '#EFF6FF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
