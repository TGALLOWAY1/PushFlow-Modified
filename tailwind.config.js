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
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        'bg-app': "var(--bg-app)",
        'bg-panel': "var(--bg-panel)",
        'bg-card': "var(--bg-card)",
        'bg-input': "var(--bg-input)",
        'bg-hover': "var(--bg-hover)",
        'bg-active': "var(--bg-active)",
        'text-primary': "var(--text-primary)",
        'text-secondary': "var(--text-secondary)",
        'text-tertiary': "var(--text-tertiary)",
        'text-warning': "var(--text-warning)",
        'border-subtle': "var(--border-subtle)",
        'border-default': "var(--border-default)",
        'border-strong': "var(--border-strong)",
        'accent-primary': "var(--accent-primary)",
        'accent-hover': "var(--accent-hover)",
        'accent-muted': "var(--accent-muted)",
      },
      borderRadius: {
        'pf-sm': '4px',
        'pf-md': '6px',
        'pf-lg': '8px',
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
