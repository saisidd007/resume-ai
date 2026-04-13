/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'surface': {
          '50': '#1a1a1a',
          '100': '#141414',
          '200': '#111111',
          '300': '#0d0d0d',
          '400': '#0a0a0a',
          '500': '#070707',
          '600': '#050505',
          '700': '#030303',
          '800': '#020202',
          '900': '#000000',
        },
        'accent': {
          DEFAULT: '#c8a84e',
          light: '#e0c872',
          dark: '#a08030',
          muted: 'rgba(200, 168, 78, 0.15)',
        },
        'text': {
          primary: '#e8e8e8',
          secondary: '#888888',
          muted: '#555555',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-subtle': 'pulseSubtle 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}
