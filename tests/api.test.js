import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import modelRoutes from '../server/routes/modelRoutes.js';
import predictionRoutes from '../server/routes/predictionRoutes.js';
import reportRoutes from '../server/routes/reportRoutes.js';

function createTestServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'DermaSense AI' }));
  app.use('/api/model', modelRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api', predictionRoutes);
  return app;
}

test('Core Express API routes respond cleanly with expected schemas', async () => {
  const app = createTestServer();
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const { port } = server.address();
    const base = `http://127.0.0.1:${port}/api`;

    const health = await fetch(`${base}/health`);
    assert.equal(health.status, 200);
    const healthJson = await health.json();
    assert.equal(healthJson.status, 'ok');

    const rulesRes = await fetch(`${base}/model/rules`);
    assert.equal(rulesRes.status, 200);
    const rulesJson = await rulesRes.json();
    assert.ok(Array.isArray(rulesJson.rules));
    assert.ok(rulesJson.rules.length >= 8);

    const metricsRes = await fetch(`${base}/model/metrics`);
    assert.equal(metricsRes.status, 200);
    const metricsJson = await metricsRes.json();
    assert.ok('modelAvailable' in metricsJson);

    const histRes = await fetch(`${base}/history`);
    assert.equal(histRes.status, 200);
    const histJson = await histRes.json();
    assert.equal(histJson.sessionScoped, true);
    assert.ok(Array.isArray(histJson.items));
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
