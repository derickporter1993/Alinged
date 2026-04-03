import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET /summary - budget summary
router.get('/summary', (_req, res) => {
  const totalSpent = db.prepare(
    `SELECT COALESCE(SUM(cost_usd), 0) AS total FROM cost_logs`
  ).get() as { total: number };

  const spentToday = db.prepare(
    `SELECT COALESCE(SUM(cost_usd), 0) AS total FROM cost_logs WHERE date(created_at) = date('now')`
  ).get() as { total: number };

  const spentThisWeek = db.prepare(
    `SELECT COALESCE(SUM(cost_usd), 0) AS total FROM cost_logs WHERE created_at >= datetime('now', '-7 days')`
  ).get() as { total: number };

  const byAgent = db.prepare(`
    SELECT a.id, a.name, a.role, a.budget_limit, a.budget_spent,
           COALESCE(SUM(cl.cost_usd), 0) AS total_cost,
           COALESCE(SUM(cl.input_tokens), 0) AS total_input_tokens,
           COALESCE(SUM(cl.output_tokens), 0) AS total_output_tokens
    FROM agents a
    LEFT JOIN cost_logs cl ON a.id = cl.agent_id
    WHERE a.status != 'terminated'
    GROUP BY a.id
    ORDER BY total_cost DESC
  `).all();

  const byGoal = db.prepare(`
    SELECT g.id, g.title,
           COALESCE(SUM(cl.cost_usd), 0) AS total_cost,
           COUNT(DISTINCT cl.id) AS api_calls
    FROM goals g
    LEFT JOIN tickets t ON g.id = t.goal_id
    LEFT JOIN cost_logs cl ON t.id = cl.ticket_id
    GROUP BY g.id
    ORDER BY total_cost DESC
  `).all();

  res.json({
    totalSpent: totalSpent.total,
    spentToday: spentToday.total,
    spentThisWeek: spentThisWeek.total,
    byAgent,
    byGoal,
  });
});

// GET /logs - paginated cost logs
router.get('/logs', (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const agentId = req.query.agent_id;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (agentId) {
    conditions.push('cl.agent_id = ?');
    params.push(agentId);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countResult = db.prepare(
    `SELECT COUNT(*) AS total FROM cost_logs cl ${whereClause}`
  ).get(...params) as { total: number };

  const logs = db.prepare(`
    SELECT cl.*, a.name AS agent_name
    FROM cost_logs cl
    LEFT JOIN agents a ON cl.agent_id = a.id
    ${whereClause}
    ORDER BY cl.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  res.json({
    logs,
    pagination: {
      page,
      limit,
      total: countResult.total,
      totalPages: Math.ceil(countResult.total / limit),
    },
  });
});

// POST /providers - create provider
router.post('/providers', (req, res) => {
  const { name, api_key, base_url } = req.body;

  if (!name || !api_key) {
    res.status(400).json({ error: 'name and api_key are required' });
    return;
  }

  try {
    const result = db.prepare(
      `INSERT INTO providers (name, api_key, base_url) VALUES (?, ?, ?)`
    ).run(name, api_key, base_url || null);

    const provider = db.prepare(`SELECT * FROM providers WHERE id = ?`).get(result.lastInsertRowid) as {
      id: number; name: string; api_key: string; base_url: string | null; created_at: string;
    };

    res.status(201).json({
      id: provider.id,
      name: provider.name,
      api_key: '****' + provider.api_key.slice(-4),
      base_url: provider.base_url,
      created_at: provider.created_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('UNIQUE constraint')) {
      res.status(409).json({ error: `Provider "${name}" already exists` });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

// GET /providers - list providers with masked api_key
router.get('/providers', (_req, res) => {
  const providers = db.prepare(`SELECT * FROM providers ORDER BY created_at DESC`).all() as {
    id: number; name: string; api_key: string; base_url: string | null; created_at: string;
  }[];

  const masked = providers.map((p) => ({
    ...p,
    api_key: '****' + p.api_key.slice(-4),
  }));

  res.json(masked);
});

export default router;
