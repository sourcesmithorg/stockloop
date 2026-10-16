import { fileURLToPath, URL } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Dev proxy keeps the frontend same-origin in development — no CORS setup needed
// while the FastAPI backend on :8000 lands.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Real stylesheets in jsdom so computed-style tests (focus rings) are possible.
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // Full-suite runs exceed vitest's 5s default under transform load (the
    // settings suite already passed explicit 20s locally — this makes it global).
    testTimeout: 20_000,
  },
});
