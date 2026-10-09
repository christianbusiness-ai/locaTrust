import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // Chargement sécurisé des variables privées depuis .env / .env.local (jamais exposées au navigateur)
  const env = loadEnv(mode, process.cwd(), '');
  const secretKey = env.SASPAY_SECRET_KEY || process.env.SASPAY_SECRET_KEY || '';

  return {
    plugins: [
      react(),
      {
        name: 'stub-core-js',
        resolveId(id) {
          if (id.startsWith('core-js')) {
            return path.resolve('./lib/core-js-stub.ts');
          }
        }
      },
      {
        name: 'saspay-api',
        // Middleware serveur Node.js interne : s'exécute côté serveur uniquement, invisible pour le client
        configureServer(server) {
          server.middlewares.use('/api/saspay/checkout', async (req, res) => {
            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.end(JSON.stringify({ error: 'Method Not Allowed' }));
              return;
            }
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const parsed = JSON.parse(body || '{}');
                if (!secretKey) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ success: false, error: 'Clé SASPAY_SECRET_KEY absente du fichier .env' }));
                  return;
                }
                const response = await fetch('https://api.saspay.me/api/v1/checkout-sessions/', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${secretKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    amount: parsed.amount || 500,
                    currency: 'XOF',
                    customer_email: parsed.customer_email || 'contact@locatrust.ci',
                    customer_name: parsed.customer_name || 'Bailleur LocaTrust',
                    customer_phone: parsed.customer_phone || '+2250700000000',
                    description: parsed.description || 'Abonnement SaaS LocaTrust',
                    return_url: parsed.return_url || ''
                  })
                });
                const data = await response.json();
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = response.status;
                res.end(JSON.stringify(data));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: e.message }));
              }
            });
          });
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
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('canvg')) {
                return 'vendor-pdf';
              }
              if (id.includes('@supabase') || id.includes('@supabase/supabase-js')) {
                return 'vendor-supabase';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (id.includes('canvas-confetti')) {
                return 'vendor-confetti';
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router') || id.includes('@remix-run') || id.includes('scheduler')) {
                return 'vendor-react';
              }
            }
          }
        }
      }
    }
  };
});
