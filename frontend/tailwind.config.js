/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        wow: {
          poor: '#9d9d9d',
          common: '#ffffff',
          uncommon: '#1eff00',
          rare: '#0070dd',
          epic: '#a335ee',
          legendary: '#ff8000',
          artifact: '#e6cc80',
          heirloom: '#00ccff',
        },
      },
    },
  },
  plugins: [],
};
