import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables into process.env for local serverless functions
  const env = loadEnv(mode, process.cwd(), '');
  Object.assign(process.env, env);

  return {
    plugins: [
      react(),
      // Dev-only middleware to serve /api/* routes from the api/ directory
      {
        name: 'api-proxy',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (!req.url?.startsWith('/api/')) return next();

            // Extract the route path: /api/generate-invoice → generate-invoice
            const route = req.url.replace(/^\/api\//, '').split('?')[0];
            const baseRoute = route.startsWith('paypal') ? 'paypal' : route;

            try {
              // Parse POST/PUT/PATCH body if present
              let body: unknown = {};
              if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
                const buffers: Buffer[] = [];
                for await (const chunk of req) {
                  buffers.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                }
                const rawBody = Buffer.concat(buffers).toString('utf-8');
                if (rawBody.trim()) {
                  try {
                    body = JSON.parse(rawBody);
                  } catch {
                    body = rawBody;
                  }
                }
              }

              // Dynamically import the handler (Vite's SSR module runner)
              const mod = await server.ssrLoadModule(`./api/${baseRoute}.ts`);

              if (typeof mod.default !== 'function') {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ ok: false, error: `No default export in api/${route}.ts` }));
                return;
              }

              // Build a minimal VercelRequest-like object
              const fakeReq = Object.assign(req, {
                query: Object.fromEntries(new URL(req.url, 'http://localhost').searchParams),
                body,
              });

              // Build a minimal VercelResponse-like object
              const fakeRes = Object.assign(res, {
                status(code: number) {
                  res.statusCode = code;
                  return fakeRes;
                },
                json(data: unknown) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                  return fakeRes;
                },
                send(bodyText: string) {
                  res.end(bodyText);
                  return fakeRes;
                },
              });

              await mod.default(fakeReq, fakeRes);
            } catch (err: unknown) {
              const message = err instanceof Error ? err.message : String(err);
              console.error(`[api-proxy] Error loading api/${route}:`, message);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: message }));
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});
