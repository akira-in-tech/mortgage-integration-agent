/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
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
