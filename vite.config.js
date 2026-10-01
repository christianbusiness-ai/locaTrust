import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'stub-core-js',
      resolveId(id) {
        if (id.startsWith('core-js')) {
          return path.resolve('./lib/core-js-stub.ts');
        }
      }
    }
  ],
  optimizeDeps: {
    exclude: ['jspdf', 'canvg', 'html2canvas', 'raf', 'performance-now', 'rgbcolor'],
  },
  resolve: {
    alias: {
      '@': path.resolve('.'),
      'next/link': path.resolve('./lib/next-stubs.tsx'),
      'next/navigation': path.resolve('./lib/next-stubs.tsx'),
    },
  },
  server: {
    port: 3000,
    host: true,
  },
});
