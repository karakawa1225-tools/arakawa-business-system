import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4fa',
          100: '#dce6f2',
          200: '#b8c9e3',
          300: '#8aa3cf',
          400: '#5c7cb8',
          500: '#3d5a96',
          600: '#2f4678',
          700: '#283a62',
          800: '#1e2d4d',
          900: '#0f172a',
          950: '#0a0f1a',
        },
        aqua: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#075985',
          900: '#0c4a6e',
          950: '#083344',
        },
        gunmetal: {
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
        },
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(15 23 42 / 0.06), 0 1px 2px -1px rgb(15 23 42 / 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
