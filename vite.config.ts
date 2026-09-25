import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/PushFlow-Modified/' : '/',
  plugins: [
    react(),
  ],
  // The scoring worker (src/ui/analysis/scoring.worker.ts) is a module worker.
  worker: {
    format: 'es',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
