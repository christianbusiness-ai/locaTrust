const { createServer } = require('vite');
const react = require('@vitejs/plugin-react');
const tailwindcss = require('tailwindcss');
const autoprefixer = require('autoprefixer');
const path = require('path');

async function start() {
  try {
    const server = await createServer({
      configFile: false,
      root: __dirname,
      plugins: [
        react(),
        {
          name: 'stub-core-js',
          resolveId(id) {
            if (id.startsWith('core-js')) {
              return path.resolve(__dirname, './lib/core-js-stub.ts');
            }
          }
        }
      ],
      css: {
        postcss: {
          plugins: [tailwindcss(), autoprefixer()],
        },
      },
      optimizeDeps: {
        exclude: ['jspdf', 'canvg', 'html2canvas', 'raf', 'performance-now', 'rgbcolor'],
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './'),
          'next/link': path.resolve(__dirname, './lib/next-stubs.tsx'),
          'next/navigation': path.resolve(__dirname, './lib/next-stubs.tsx'),
        },
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
    });
    await server.listen();
    console.log('LocaTrust dev server started successfully at http://localhost:3000');
  } catch (err) {
    console.error('Failed to start Vite dev server:', err);
    process.exit(1);
  }
}

start();
