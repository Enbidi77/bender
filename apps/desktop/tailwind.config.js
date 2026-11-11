/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/renderer/index.html',
    './src/renderer/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
    '../../packages/viewport/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        blender: {
          dark: '#1d1e22',
          panel: '#282828',
          item: '#303030',
          hover: '#3e3e3e',
          active: '#4772b3',
          border: '#181818',
          text: '#dedede',
          muted: '#808080',
        },
      },
    },
  },
  plugins: [],
};
