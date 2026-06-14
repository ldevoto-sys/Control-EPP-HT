/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'ht-navy': '#112548',
        'ht-cyan': '#34B3DE',
      },
    },
  },
  plugins: [],
}

