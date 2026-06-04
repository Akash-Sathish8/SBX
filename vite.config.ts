import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'

// Tailwind + devtools intentionally removed: this app injects each page's
// original CSS verbatim (per-route) for pixel-exact parity with the static site,
// and devtools UI must not appear in screenshots.
const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [tanstackStart(), viteReact()],
})

export default config
