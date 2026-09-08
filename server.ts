import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  checkConnection,
  initializeSchema,
  getAllServers,
  upsertServer,
  deleteServerById,
  getAllPackages,
  upsertPackage,
  deletePackageById,
  getAllAuditLogs,
  insertAuditLog,
  getActiveBaseline,
  saveActiveBaseline,
  getCampaigns,
  upsertCampaign,
  getDetailedStats,
  seedInitialData,
  getDatabaseConfig
} from './src/server/db';

const PORT = 3000;

async function startServer() {
  const app = express();

  // Parse JSON payloads
  app.use(express.json({ limit: '10mb' }));

  // Initialize DB asynchronously without blocking server boot
  (async () => {
    console.log('[Server] Attempting PostgreSQL connection...');
    const conn = await checkConnection();
    if (conn.connected) {
      console.log(`[Server] PostgreSQL connected successfully (${conn.latencyMs}ms). Initializing schema...`);
      await initializeSchema();
    } else {
      console.warn(`[Server] PostgreSQL is currently offline/unreachable: ${conn.error}`);
      console.warn('[Server] To start PostgreSQL locally, run: docker compose up -d');
    }
  })();

  // -------------------------------------------------------------
  // API Routes
  // -------------------------------------------------------------

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // Database Connection & Diagnostics status
  app.get('/api/db/status', async (req, res) => {
    try {
      const stats = await getDetailedStats();
      const config = getDatabaseConfig();
      // Mask credentials in displayed connection string
      const sanitizedUrl = config.connectionString 
        ? config.connectionString.replace(/:([^:@]+)@/, ':••••••••@')
        : 'Not configured';

      res.json({
        ...stats,
        connectionStringSanitized: sanitizedUrl,
        isDockerComposeRecommended: true,
      });
    } catch (e: any) {
      res.status(500).json({ connected: false, error: e.message });
    }
  });

  // Database retry/reconnect test
  app.post('/api/db/test', async (req, res) => {
    try {
      const conn = await checkConnection();
      if (conn.connected) {
        await initializeSchema();
        const stats = await getDetailedStats();
        res.json({ success: true, ...stats });
      } else {
        res.json({ success: false, error: conn.error });
      }
    } catch (e: any) {
      res.json({ success: false, error: e.message });
    }
  });

  // Re-seed Database with clean Datacenter Fleet
  app.post('/api/db/seed', async (req, res) => {
    try {
      await seedInitialData();
      const stats = await getDetailedStats();
      res.json({ success: true, message: 'Database successfully re-seeded.', stats });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // Export full Database backup
  app.get('/api/db/export', async (req, res) => {
    try {
      const [servers, packages, auditLogs, baseline, campaigns] = await Promise.all([
        getAllServers().catch(() => []),
        getAllPackages().catch(() => []),
        getAllAuditLogs().catch(() => []),
        getActiveBaseline().catch(() => null),
        getCampaigns().catch(() => []),
      ]);

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="firmware-hub-backup.json"');
      res.json({
        version: '1.0',
        exportedAt: new Date().toISOString(),
        data: { servers, packages, auditLogs, baseline, campaigns },
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Servers CRUD
  app.get('/api/servers', async (req, res) => {
    try {
      const servers = await getAllServers();
      res.json(servers);
    } catch (e: any) {
      res.status(503).json({ error: e.message, fallbackRequired: true });
    }
  });

  app.post('/api/servers', async (req, res) => {
    try {
      const server = req.body;
      if (!server || !server.id || !server.hostname) {
        return res.status(400).json({ error: 'Server id and hostname are required' });
      }
      await upsertServer(server);
      res.json({ success: true, server });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put('/api/servers/:id', async (req, res) => {
    try {
      const server = req.body;
      await upsertServer(server);
      res.json({ success: true, server });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/servers/:id', async (req, res) => {
    try {
      await deleteServerById(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Firmware Packages CRUD
  app.get('/api/packages', async (req, res) => {
    try {
      const packages = await getAllPackages();
      res.json(packages);
    } catch (e: any) {
      res.status(503).json({ error: e.message, fallbackRequired: true });
    }
  });

  app.post('/api/packages', async (req, res) => {
    try {
      const pkg = req.body;
      await upsertPackage(pkg);
      res.json({ success: true, package: pkg });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.delete('/api/packages/:id', async (req, res) => {
    try {
      await deletePackageById(req.params.id);
      res.json({ success: true, id: req.params.id });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Audit Logs
  app.get('/api/audit-logs', async (req, res) => {
    try {
      const logs = await getAllAuditLogs();
      res.json(logs);
    } catch (e: any) {
      res.status(503).json({ error: e.message, fallbackRequired: true });
    }
  });

  app.post('/api/audit-logs', async (req, res) => {
    try {
      const log = req.body;
      await insertAuditLog(log);
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Baseline
  app.get('/api/baseline', async (req, res) => {
    try {
      const baseline = await getActiveBaseline();
      res.json(baseline);
    } catch (e: any) {
      res.status(503).json({ error: e.message, fallbackRequired: true });
    }
  });

  app.put('/api/baseline', async (req, res) => {
    try {
      const baseline = req.body;
      await saveActiveBaseline(baseline);
      res.json({ success: true, baseline });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Campaigns
  app.get('/api/campaigns', async (req, res) => {
    try {
      const campaigns = await getCampaigns();
      res.json(campaigns);
    } catch (e: any) {
      res.status(503).json({ error: e.message, fallbackRequired: true });
    }
  });

  app.post('/api/campaigns', async (req, res) => {
    try {
      const campaign = req.body;
      await upsertCampaign(campaign);
      res.json({ success: true, campaign });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // -------------------------------------------------------------
  // Frontend Serving (Vite middleware in dev, Static in production)
  // -------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    console.log('[Server] Mounting Vite middleware in development mode...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    console.log(`[Server] Serving production static assets from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Server] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
