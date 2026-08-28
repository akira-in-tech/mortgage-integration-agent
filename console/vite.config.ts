/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The browser talks to one origin in development as it will in release.
    // Cookies are therefore first-party and no token-bearing CORS path exists.
    proxy: {
      '/graphql': 'http://localhost:3000',
      '/v1': 'http://localhost:3000',
    },
  },
  test: {
    // Browser journeys use Playwright's own runner; keeping Vitest scoped to
    // source-level tests prevents either framework from collecting the
    // other's files and producing misleading duplicate-runner failures.
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
