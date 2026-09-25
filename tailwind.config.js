/**
 * A --token colour that also takes Tailwind's opacity modifier
 * (bg-accent-primary/80). A bare var() can't, so such classes used to compile
 * to nothing (T38); color-mix scales the token's own alpha instead.
 */
const token = name => `color-mix(in srgb, var(--${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'headline': ['Space Grotesk', 'Inter', 'sans-serif'],
        'body': ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        'label': ['Inter', 'sans-serif'],
      },
      colors: {
        background: token('background'),
        foreground: token('foreground'),
        border: token('border'),
        'bg-app': token('bg-app'),
        'bg-panel': token('bg-panel'),
        'bg-card': token('bg-card'),
        'bg-input': token('bg-input'),
        'bg-hover': token('bg-hover'),
        'bg-active': token('bg-active'),
        'text-primary': token('text-primary'),
        'text-secondary': token('text-secondary'),
        'text-tertiary': token('text-tertiary'),
        'text-warning': token('text-warning'),
        'border-subtle': token('border-subtle'),
        'border-default': token('border-default'),
        'border-strong': token('border-strong'),
        'accent-primary': token('accent-primary'),
        'accent-primary-soft': token('accent-primary-soft'),
        'accent-hover': token('accent-hover'),
        'accent-muted': token('accent-muted'),
        'accent-secondary': token('accent-secondary'),
        'accent-secondary-strong': token('accent-secondary-strong'),
        'accent-tertiary': token('accent-tertiary'),
        'accent-tertiary-strong': token('accent-tertiary-strong'),
        /* M3-inspired surface scale */
        'surface': '#131313',
        'surface-dim': '#0e0e0e',
        'surface-container-low': '#1c1b1b',
        'surface-container': '#201f1f',
        'surface-container-high': '#2a2a2a',
        'surface-container-highest': '#353534',
        'surface-bright': '#3a3939',
        'surface-tint': '#b8c3ff',
      },
      borderRadius: {
        'pf-sm': '4px',
        'pf-md': '8px',
        'pf-lg': '12px',
      },
      fontSize: {
        'pf-micro': ['11px', { lineHeight: '14px', fontWeight: '500' }],
        'pf-xs': ['12px', { lineHeight: '16px' }],
        'pf-sm': ['13px', { lineHeight: '18px' }],
        'pf-base': ['14px', { lineHeight: '20px' }],
        'pf-md': ['15px', { lineHeight: '22px' }],
        'pf-lg': ['17px', { lineHeight: '24px' }],
        'pf-xl': ['20px', { lineHeight: '28px' }],
      },
      boxShadow: {
        'pf-sm': 'var(--shadow-sm)',
        'pf-md': 'var(--shadow-md)',
        'pf-lg': 'var(--shadow-lg)',
        'pf-xl': 'var(--shadow-xl)',
      },
      transitionTimingFunction: {
        'pf': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
      },
      transitionDuration: {
        'fast': '80ms',
        'normal': '120ms',
        'slow': '200ms',
      },
    },
  },
  plugins: [],
}
