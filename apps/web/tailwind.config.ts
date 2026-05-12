import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: '#0d1117', subtle: '#161b22', strong: '#21262d' },
        accent: {
          force: '#ff4757',
          endurance: '#ff9f43',
          vitality: '#2ed573',
          discipline: '#3742fa',
          appearance: '#a55eea',
          spirit: '#00d9ff',
          xp: '#58a6ff',
          streak: '#f78166',
        },
        text: { DEFAULT: '#c9d1d9', muted: '#8b949e' },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        display: ['Cinzel', 'serif'],
      },
    },
  },
  plugins: [],
};
export default config;
