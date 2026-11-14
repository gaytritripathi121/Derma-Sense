import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PATHS } from './config/constants.js';
import predictionRoutes from './routes/predictionRoutes.js';
import modelRoutes from './routes/modelRoutes.js';
import reportRoutes from './routes/reportRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const VITE_CLIENT_NO_WS_SHIM = `
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function injectQuery(url) { return url; }
export function createHotContext() {
  return {
    accept() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
    data: {},
  };
}
export class ErrorOverlay {}
`;

function cleanTempFolderOnBoot() {
  try {
    fs.mkdirSync(PATHS.tmpDir, { recursive: true });
    for (const entry of fs.readdirSync(PATHS.tmpDir)) {
      const target = path.join(PATHS.tmpDir, entry);
      fs.rmSync(target, { recursive: true, force: true });
    }
  } catch {
    // non-fatal cleanup failure
  }
}

async function startServer() {
  cleanTempFolderOnBoot();

  const app = express();
  const port = Number(process.env.PORT || 3000);
  const isProd = process.env.NODE_ENV === 'production';

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'DermaSense AI',
      environment: isProd ? 'production' : 'development',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/model', modelRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api', predictionRoutes);

  if (!isProd) {
    // Serve a zero-WebSocket Vite client shim because HMR WebSockets are disabled in this proxy environment
    app.get('/@vite/client', (_req, res) => {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.send(VITE_CLIENT_NO_WS_SHIM);
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(ROOT_DIR, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.use((err, req, res, _next) => {
    const status = err.statusCode || (err.name === 'MulterError' ? 400 : 500);
    const message =
      err.message || 'An unexpected server error occurred while processing your request.';
    res.status(status).json({
      error: message,
      ...(err.quality ? { quality: err.quality } : {}),
      ...(err.details ? { details: err.details } : {}),
    });
  });

  app.listen(port, '0.0.0.0', () => {
    console.log(`DermaSense AI server listening on http://0.0.0.0:${port} (${isProd ? 'production' : 'development'})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start DermaSense AI server:', err);
  process.exit(1);
});
