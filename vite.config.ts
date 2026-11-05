/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // relative asset paths: the same build works at a domain root (Vercel, Netlify)
  // and under a sub-path such as GitHub Pages (/silabsim01/)
  base: './',
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (/[\\/](three|@react-three|postprocessing|three-stdlib|camera-controls|maath)[\\/]/.test(id)) return 'vendor-3d'
            if (/[\\/](recharts|d3-|victory|decimal\.js)/.test(id)) return 'vendor-charts'
          }
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
