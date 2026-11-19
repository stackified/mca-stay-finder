/// <reference types="vitest/config" />
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the static build also works on GitHub Pages sub-paths.
  base: './',
  plugins: [react(), tailwindcss()],
  // Pre-bundle map libraries up front so Vite does not re-optimise mid-session.
  optimizeDeps: { include: ['maplibre-gl', 'react-map-gl/maplibre'] },
  build: {
    // MapLibre alone is ~1 MB minified; it is already split into its own lazy chunk.
    chunkSizeWarningLimit: 1500,
  },
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
  },
})
