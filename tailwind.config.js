/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paypal: {
          dark: '#003087',
          blue: '#0070E0',
          light: '#00A3E0',
        },
      },
    },
  },
  plugins: [],
};

