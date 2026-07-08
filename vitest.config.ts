// Standalone vitest config — vite.config.ts loads the Cloudflare Workers
// plugin, which is incompatible with vitest's test server. Unit tests don't
// need any of the app plugins, so this config only wires the path aliases
// the lib code uses and runs in a plain node environment.
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '#': fileURLToPath(new URL('./src', import.meta.url)),
      '@/lib': fileURLToPath(new URL('./src/lib', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
