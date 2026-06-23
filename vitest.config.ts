import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Fix 12: return a stub for any .png/.jpg/.svg import so component tests
// don't depend on the real asset loader.
const assetStubPlugin = {
  name: 'asset-stub',
  resolveId(id: string) {
    if (/\.(png|jpe?g|svg)$/.test(id)) {
      return new URL('./test/asset-stub.ts', import.meta.url).pathname;
    }
    return undefined;
  },
};

export default defineConfig({
  plugins: [react(), assetStubPlugin],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'prisma/**/*.test.ts', '*.test.ts', '*.test.tsx'],
  },
});
