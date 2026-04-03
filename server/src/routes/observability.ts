import { Router } from 'express';
import db from '../db.js';
import { getIO } from '../socket.js';

const router = Router();

// ─── Interfaces ───────────────────────────────────────────────

interface ConversationLogRow {
  id: number;
  agent_id: number;
  ticket_id: number | null;
  role: string;
  content: string;
  tokens: number;
  created_at: string;
  agent_name?: string;
}

interface DailySpendRow {
  day: string;
  daily_cost: number;
}

interface DependencyRow {
  id: number;
  ticket_id: number;
  depends_on_id: number;
  created_at: string;
  ticket_title?: string;
  depends_on_title?: string;
}

interface TicketNodeRow {
  id: number;
  title: string;
  status: string;
}

// ═══════════════════════════════════════════════════════════════
//  CONVERSATION LOGS
// ═══════════════════════════════════════════════════════════════

// ─── GET /logs ────────────────────────────────────────────────

router.get('/logs', (req, res) => {
  const agentId = req.query.agent_id ? Number(req.query.agent_id) : null;
  const ticketId = req.query.ticket_id ? Number(req.query.ticket_id) : null;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  let whereConditions: string[] = [];
  const params: unknown[] = [];

  if (agentId) {
    whereConditions.push(`cl.agent_id = ?`);
    params.push(agentId);
  }
  if (ticketId) {
    whereConditions.push(`cl.ticket_id = ?`);
    params.push(ticketId);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Get total count
  const countRow = db.prepare(
    `SELECT COUNT(*) AS total FROM conversation_logs cl ${whereClause}`
  ).get(...params) as { total: number };

  // Get paginated results
  const rows = db.prepare(`
    SELECT cl.*, a.name AS agent_name
    FROM conversation_logs cl
    JOIN agents a ON a.id = cl.agent_id
    ${whereClause}
    ORDER BY cl.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ConversationLogRow[];

  res.json({
    data: rows,
    page,
    limit,
    total: countRow.total,
    totalPages: Math.ceil(countRow.total / limit),
  });
});

// ─── GET /logs/ticket/:ticketId ───────────────────────────────

router.get('/logs/ticket/:ticketId', (req, res) => {
  const ticketId = Number(req.params.ticketId);

  const rows = db.prepare(`
    SELECT cl.*, a.name AS agent_name
    FROM conversation_logs cl
    JOIN agents a ON a.id = cl.agent_id
    WHERE cl.ticket_id = ?
    ORDER BY cl.created_at ASC
  `).all(ticketId) as ConversationLogRow[];

  res.json(rows);
});

// ─── DELETE /logs ─────────────────────────────────────────────

router.delete('/logs', (req, res) => {
  const days = Number(req.query.days) || 30;

  const result = db.prepare(
    `DELETE FROM conversation_logs WHERE created_at < datetime('now', ?)`
  ).run(`-${days} days`);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('logs_cleared', `Cleared ${result.changes} conversation logs older than ${days} days`, JSON.stringify({ deleted: result.changes, days }));

  res.json({ deleted: result.changes, days });
});

// ═══════════════════════════════════════════════════════════════
//  COST FORECASTING
// ═══════════════════════════════════════════════════════════════

// ─── GET /forecast ────────────────────────────────────────────

router.get('/forecast', (_req, res) => {
  // Query cost_logs grouped by date for the last 30 days
  const rows = db.prepare(`
    SELECT DATE(created_at) AS day, SUM(cost_usd) AS daily_cost
    FROM cost_logs
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY DATE(created_at)
    ORDER BY day ASC
  `).all() as DailySpendRow[];

  const daysOfData = rows.length;

  if (daysOfData === 0) {
    res.json({
      dailyRate: 0,
      weeklyRate: 0,
      monthlyProjection: 0,
      daysOfData: 0,
    });
    return;
  }

  const totalSpend = rows.reduce((sum, r) => sum + r.daily_cost, 0);
  const dailyRate = totalSpend / daysOfData;
  const weeklyRate = dailyRate * 7;
  const monthlyProjection = dailyRate * 30;

  res.json({
    dailyRate: Math.round(dailyRate * 10000) / 10000,
    weeklyRate: Math.round(weeklyRate * 10000) / 10000,
    monthlyProjection: Math.round(monthlyProjection * 10000) / 10000,
    daysOfData,
  });
});

// ═══════════════════════════════════════════════════════════════
//  DEPENDENCY GRAPH
// ═══════════════════════════════════════════════════════════════

// ─── GET /dependencies ────────────────────────────────────────

router.get('/dependencies', (_req, res) => {
  const rows = db.prepare(`
    SELECT
      td.*,
      t1.title AS ticket_title,
      t2.title AS depends_on_title
    FROM ticket_dependencies td
    JOIN tickets t1 ON t1.id = td.ticket_id
    JOIN tickets t2 ON t2.id = td.depends_on_id
    ORDER BY td.created_at DESC
  `).all() as DependencyRow[];

  res.json(rows);
});

// ─── GET /dependencies/graph ──────────────────────────────────
// Note: this route must be defined before /dependencies/:ticketId
// to avoid "graph" being matched as a ticketId parameter.

router.get('/dependencies/graph', (_req, res) => {
  // Get all tickets involved in any dependency
  const deps = db.prepare(`SELECT ticket_id, depends_on_id FROM ticket_dependencies`).all() as Array<{ ticket_id: number; depends_on_id: number }>;

  // Collect all unique ticket IDs involved in dependencies
  const ticketIds = new Set<number>();
  const edges: Array<{ from: number; to: number }> = [];

  for (const dep of deps) {
    ticketIds.add(dep.ticket_id);
    ticketIds.add(dep.depends_on_id);
    edges.push({ from: dep.ticket_id, to: dep.depends_on_id });
  }

  // Fetch ticket info for all nodes
  let nodes: TicketNodeRow[] = [];
  if (ticketIds.size > 0) {
    const placeholders = Array.from(ticketIds).map(() => '?').join(',');
    nodes = db.prepare(
      `SELECT id, title, status FROM tickets WHERE id IN (${placeholders})`
    ).all(...Array.from(ticketIds)) as TicketNodeRow[];
  }

  res.json({ nodes, edges });
});

// ─── GET /dependencies/:ticketId ──────────────────────────────

router.get('/dependencies/:ticketId', (req, res) => {
  const ticketId = Number(req.params.ticketId);

  // What this ticket depends on
  const dependsOn = db.prepare(`
    SELECT td.*, t.title AS depends_on_title, t.status AS depends_on_status
    FROM ticket_dependencies td
    JOIN tickets t ON t.id = td.depends_on_id
    WHERE td.ticket_id = ?
    ORDER BY td.created_at DESC
  `).all(ticketId);

  // What depends on this ticket
  const dependedOnBy = db.prepare(`
    SELECT td.*, t.title AS ticket_title, t.status AS ticket_status
    FROM ticket_dependencies td
    JOIN tickets t ON t.id = td.ticket_id
    WHERE td.depends_on_id = ?
    ORDER BY td.created_at DESC
  `).all(ticketId);

  res.json({ depends_on: dependsOn, depended_on_by: dependedOnBy });
});

// ─── POST /dependencies ──────────────────────────────────────

router.post('/dependencies', (req, res) => {
  const { ticket_id, depends_on_id } = req.body;

  if (!ticket_id || !depends_on_id) {
    res.status(400).json({ error: 'ticket_id and depends_on_id are required' });
    return;
  }

  if (ticket_id === depends_on_id) {
    res.status(400).json({ error: 'A ticket cannot depend on itself' });
    return;
  }

  // Validate both tickets exist
  const ticket = db.prepare(`SELECT id FROM tickets WHERE id = ?`).get(ticket_id);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  const dependsOnTicket = db.prepare(`SELECT id FROM tickets WHERE id = ?`).get(depends_on_id);
  if (!dependsOnTicket) {
    res.status(404).json({ error: 'depends_on ticket not found' });
    return;
  }

  // Check for circular dependency: does depends_on_id (directly or transitively) depend on ticket_id?
  const visited = new Set<number>();
  const queue = [depends_on_id];

  while (queue.length > 0) {
    const current = queue.pop()!;
    if (current === ticket_id) {
      res.status(400).json({ error: 'Circular dependency detected' });
      return;
    }
    if (visited.has(current)) continue;
    visited.add(current);

    // Find what `current` depends on
    const upstream = db.prepare(
      `SELECT depends_on_id FROM ticket_dependencies WHERE ticket_id = ?`
    ).all(current) as Array<{ depends_on_id: number }>;

    for (const u of upstream) {
      if (!visited.has(u.depends_on_id)) {
        queue.push(u.depends_on_id);
      }
    }
  }

  // Check for duplicate
  const existing = db.prepare(
    `SELECT id FROM ticket_dependencies WHERE ticket_id = ? AND depends_on_id = ?`
  ).get(ticket_id, depends_on_id);
  if (existing) {
    res.status(409).json({ error: 'Dependency already exists' });
    return;
  }

  const result = db.prepare(
    `INSERT INTO ticket_dependencies (ticket_id, depends_on_id) VALUES (?, ?)`
  ).run(ticket_id, depends_on_id);

  const created = db.prepare(`SELECT * FROM ticket_dependencies WHERE id = ?`).get(result.lastInsertRowid);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('dependency_created', `Dependency created: ticket #${ticket_id} depends on #${depends_on_id}`, JSON.stringify({ ticket_id, depends_on_id }));

  try {
    const io = getIO();
    io.emit('dependency:created', created);
  } catch { /* socket not ready */ }

  res.status(201).json(created);
});

// ─── DELETE /dependencies/:id ─────────────────────────────────

router.delete('/dependencies/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM ticket_dependencies WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Dependency not found' });
    return;
  }

  db.prepare(`DELETE FROM ticket_dependencies WHERE id = ?`).run(id);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('dependency_deleted', `Dependency #${id} deleted`, JSON.stringify({ dependency_id: id }));

  try {
    const io = getIO();
    io.emit('dependency:deleted', { id });
  } catch { /* socket not ready */ }

  res.json({ success: true });
});

export default router;
