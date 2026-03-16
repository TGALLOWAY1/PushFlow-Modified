/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        border: "var(--border)",
        'bg-app': "var(--bg-app)",
        'bg-panel': "var(--bg-panel)",
        'bg-card': "var(--bg-card)",
        'bg-input': "var(--bg-input)",
        'text-primary': "var(--text-primary)",
        'text-secondary': "var(--text-secondary)",
        'text-tertiary': "var(--text-tertiary)",
        'text-warning': "var(--text-warning)",
        'border-subtle': "var(--border-subtle)",
        'border-strong': "var(--border-strong)",
      }
    },
  },
  plugins: [],
}

