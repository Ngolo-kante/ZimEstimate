import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(rootDir, 'src'),
    },
  },
});
