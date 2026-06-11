// Standalone vitest config — vite.config.ts loads the Cloudflare Workers
// plugin, which is incompatible with vitest's test server. Unit tests don't
// need any of the app plugins.
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '#': fileURLToPath(new URL('./src', import.meta.url)),
      '@/lib': fileURLToPath(new URL('./src/casey/lib', import.meta.url)),
      '@': fileURLToPath(new URL('./src/casey', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
  },
})
