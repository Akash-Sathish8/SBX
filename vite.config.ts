import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Tailwind + devtools intentionally removed: this app injects each page's
// original CSS verbatim (per-route) for pixel-exact parity with the static site,
// and devtools UI must not appear in screenshots.
const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@/lib': fileURLToPath(new URL('./src/casey/lib', import.meta.url)),
      '@/data': fileURLToPath(new URL('./src/casey/data', import.meta.url)),
    },
  },
  plugins: [tanstackStart(), viteReact()],
})

export default config
