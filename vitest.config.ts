import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      src: resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    exclude: ['test/**', 'dist/**', 'node_modules/**'],
    passWithNoTests: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/main.ts',
        'src/**/*.module.ts',
        'src/**/*.controller.ts',
        'src/**/*.entity.ts',
        'src/**/dto/update-category.dto.ts',
        'src/**/*.spec.ts',
      ],
      thresholds: {
        lines: 90,
        branches: 85,
      },
    },
  },
});
