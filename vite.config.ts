import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// The marketing/consumer pages inject each route's original CSS verbatim for
// pixel-exact parity with the static site — they do NOT use Tailwind. Tailwind
// (v4) is scoped to the Casey tracker only: src/pages/casey-tracker.css opts in
// via `@import 'tailwindcss/...'` (theme + utilities, no preflight) and the
// plugin compiles it. CSS files without those directives pass through untouched,
// so the verbatim-CSS pages are unaffected.
const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@/lib': fileURLToPath(new URL('./src/casey/lib', import.meta.url)),
      '@/data': fileURLToPath(new URL('./src/casey/data', import.meta.url)),
    },
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tanstackStart(),
    viteReact(),
    tailwindcss(),
  ],
})

export default config
