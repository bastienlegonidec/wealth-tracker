import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0c0f0a',
        surface: '#141810',
        surface2: '#1c2117',
        border: '#2a321f',
        accent: '#a8d060',
        accent2: '#d4f07a',
        muted: '#6b7d54',
        danger: '#e86060',
        gold: '#d4a84b',
        blue: '#6098d0',
      },
      fontFamily: {
        serif: ['DM Serif Display', 'Georgia', 'serif'],
        mono: ['DM Mono', 'Menlo', 'monospace'],
        sans: ['Instrument Sans', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
