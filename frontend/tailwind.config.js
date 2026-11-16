/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#050D0B',
        sidebar: '#07120F',
        card: '#0B1713',
        panel: '#101E19',
        brand: '#32D583',
        bright: '#4ADE80',
        line: '#18352A',
        ink: '#F4F7F5',
        muted: '#9CAFA5',
        danger: '#FF4D4D',
        warn: '#F59E0B',
        info: '#38BDF8',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(50,213,131,.25), 0 0 18px rgba(50,213,131,.08)',
      },
    },
  },
  plugins: [],
}
