import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initSocket } from './socket.js';
import './db.js';

import goalsRouter from './routes/goals.js';
import agentsRouter from './routes/agents.js';
import ticketsRouter from './routes/tickets.js';
import budgetRouter from './routes/budget.js';
import dashboardRouter from './routes/dashboard.js';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount routes
app.use('/api/goals', goalsRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/budget', budgetRouter);
app.use('/api/dashboard', dashboardRouter);

// Create HTTP server and attach Socket.io
const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[Server] Alinged server running on http://localhost:${PORT}`);
});

export default app;
