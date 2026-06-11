import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Standalone test config. The app's vite.config.ts pulls in the Cloudflare and
// TanStack Start plugins (which expect a worker/SSR environment); we don't want
// those when unit-testing pure lib functions, so this config only wires the
// path aliases the lib code uses and runs in a plain node environment.
export default defineConfig({
  resolve: {
    alias: {
      '@/lib': fileURLToPath(new URL('./src/casey/lib', import.meta.url)),
      '@/data': fileURLToPath(new URL('./src/casey/data', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
