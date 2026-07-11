import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// Styling is migrating BACK to Tailwind (v4, CSS-first config in
// src/styles/tailwind.css). Legacy per-route CSS files remain until each page
// is converted — new/converted surfaces use utilities only. Devtools UI stays
// removed (must not appear in screenshots).
const config = defineConfig({
  server: {
    allowedHosts: ["curler-thrive-crested.ngrok-free.dev"],
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@/lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  plugins: [
    tailwindcss(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
