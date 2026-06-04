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
  // @resvg/resvg-js (used by the /api/og share-image route) ships a native
  // .node binding that vite's dep optimizer can't pre-bundle (crashes dev).
  // Keep it out of optimization and load it as an external at runtime.
  optimizeDeps: { exclude: ['@resvg/resvg-js'] },
  ssr: { external: ['@resvg/resvg-js'] },
  plugins: [tanstackStart(), viteReact()],
})

export default config
