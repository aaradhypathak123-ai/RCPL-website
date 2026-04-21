/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Layered surface system (base → elevated → floating)
        bg: {
          base:     '#080C14',
          surface:  '#0D1422',
          elevated: '#141D2E',
          floating: '#1B2640',
        },
        border: {
          DEFAULT: '#243050',
          subtle:  '#1C2744',
          bright:  '#2E3D60',
        },
        // Primary: electric periwinkle (not Tailwind indigo/blue)
        primary: {
          DEFAULT: '#5A7FFF',
          dark:    '#4A6FEF',
          light:   '#7A9FFF',
        },
        // Accent: warm amber
        accent: {
          DEFAULT: '#FFB547',
          dark:    '#E8A030',
        },
        // Danger / success
        danger:  '#FF5C6A',
        success: '#34D399',
        // Text hierarchy
        ink: {
          primary:   '#E2E8F0',
          secondary: '#94A3B8',
          muted:     '#4B5B72',
        },
      },
      fontFamily: {
        display: ['"DM Sans"', 'sans-serif'],
        body:    ['"Inter"', 'sans-serif'],
      },
      boxShadow: {
        'pop':    '0 8px 24px rgba(90, 127, 255, 0.30), 0 2px 8px rgba(0,0,0,0.40)',
        'card':   '0 4px 24px rgba(0,0,0,0.50), 0 0 0 1px rgba(255,255,255,0.03)',
        'glow':   '0 0 32px rgba(90, 127, 255, 0.18)',
        'inset':  'inset 0 1px 0 rgba(255,255,255,0.05)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}
