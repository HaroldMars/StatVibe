import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#070b12',
          900: '#0c1220',
          800: '#121a2b',
          700: '#1a2438',
        },
        mist: {
          100: '#e8eef8',
          300: '#a8b6cf',
          500: '#6e7f9c',
        },
        signal: {
          DEFAULT: '#2dd4bf',
          deep: '#14b8a6',
          soft: 'rgba(45, 212, 191, 0.14)',
        },
        ember: {
          DEFAULT: '#f59e0b',
          soft: 'rgba(245, 158, 11, 0.16)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 0 60px rgba(45, 212, 191, 0.12)',
        soft: '0 24px 60px rgba(0, 0, 0, 0.35)',
      },
      backgroundImage: {
        'hero-mesh':
          'radial-gradient(ellipse 80% 60% at 20% -10%, rgba(45, 212, 191, 0.22), transparent 55%), radial-gradient(ellipse 70% 50% at 90% 10%, rgba(245, 158, 11, 0.12), transparent 50%), radial-gradient(ellipse 50% 40% at 50% 100%, rgba(56, 189, 248, 0.08), transparent 60%)',
      },
    },
  },
  plugins: [],
};

export default config;
