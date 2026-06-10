import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standalone build for Casey's Matchday Agenda — a plain client-side React SPA
// (no TanStack / no SSR), output to dist-agenda/ for static hosting (Vercel).
// Reuses the repo's existing deps + the ShareCard/teams/shareFonts source.
export default defineConfig({
  plugins: [react()],
  root: 'agenda-standalone',
  publicDir: 'public',
  build: { outDir: '../dist-agenda', emptyOutDir: true },
})
