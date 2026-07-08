import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import viteReact from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Tailwind + devtools intentionally removed: this app injects each page's
// original CSS verbatim (per-route) for pixel-exact parity with the static site,
// and devtools UI must not appear in screenshots.
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
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
