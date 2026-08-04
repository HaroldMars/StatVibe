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
        cream: '#F4F7F1',
        leaf: {
          950: '#0B1810',
          900: '#16211A',
          800: '#1C3F27',
          600: '#1A8F4D',
          400: '#C0F26D',
          200: '#E2EDD8',
          100: '#ECF3E8',
        },
        moss: {
          500: '#3E4A41',
          400: '#7C867E',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 24px 60px rgba(11, 24, 16, 0.08)',
        lift: '0 12px 32px rgba(28, 63, 39, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
