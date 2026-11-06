import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'rgb(var(--brand) / <alpha-value>)',
          ink: 'rgb(var(--brand-ink) / <alpha-value>)',
        },
        ground: '#F5F4F0',
        line: '#E2E0DA',
        ink: '#1B1B1F',
        muted: '#5C5C66',
        accent: '#F4A51C',
        good: '#0E6B47',
        bad: '#B3261E',
        warn: '#8A4B00',
        mint: '#E3F1E8',
        sand: '#FFF1D6',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-inter)', 'sans-serif'],
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};

export default config;
