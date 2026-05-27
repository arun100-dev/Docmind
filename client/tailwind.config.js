/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        ink: {
          950: '#05050a',
          900: '#0a0a12',
          800: '#111120',
          700: '#1a1a2e',
          600: '#252540',
        },
        acid: {
          DEFAULT: '#c8f135',
          dim: '#9ab825',
          glow: '#d4f55a',
        },
        ghost: {
          DEFAULT: '#e8e8f0',
          dim: '#9090a8',
          faint: '#3a3a58',
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease forwards',
        'pulse-dot': 'pulseDot 1.4s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        'slide-in': 'slideIn 0.3s ease forwards',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 80%, 100%': { transform: 'scale(0)', opacity: 0.3 },
          '40%': { transform: 'scale(1)', opacity: 1 },
        },
        shimmer: {
          from: { backgroundPosition: '-200% 0' },
          to: { backgroundPosition: '200% 0' },
        },
        slideIn: {
          from: { opacity: 0, transform: 'translateX(-8px)' },
          to: { opacity: 1, transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};
