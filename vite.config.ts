/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/auto-lab/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // ExcelJS (~930 kB) is only loaded when a download button is pressed.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'jsdom',
  },
})
