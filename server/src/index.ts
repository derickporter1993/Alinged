import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initSocket } from './socket.js';
import './db.js';

import authRouter from './routes/auth.js';
import { authMiddleware } from './middleware/auth.js';

import goalsRouter from './routes/goals.js';
import agentsRouter from './routes/agents.js';
import ticketsRouter from './routes/tickets.js';
import budgetRouter from './routes/budget.js';
import dashboardRouter from './routes/dashboard.js';
import collaborationRouter from './routes/collaboration.js';
import automationRouter from './routes/automation.js';
import qualityRouter from './routes/quality.js';
import intelligenceRouter from './routes/intelligence.js';
import integrationsRouter from './routes/integrations.js';
import observabilityRouter from './routes/observability.js';
import { startScheduler } from './services/scheduler.js';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Health check (unprotected)
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (unprotected)
app.use('/api/auth', authRouter);

// All subsequent routes require authentication
app.use('/api', authMiddleware);

// Mount protected routes
app.use('/api/goals', goalsRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/budget', budgetRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/collaboration', collaborationRouter);
app.use('/api/automation', automationRouter);
app.use('/api/quality', qualityRouter);
app.use('/api/intelligence', intelligenceRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/observability', observabilityRouter);

// Create HTTP server and attach Socket.io
const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[Server] HiveMind server running on http://localhost:${PORT}`);
  startScheduler();
});

export default app;
