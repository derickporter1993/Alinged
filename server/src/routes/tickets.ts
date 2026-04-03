import { Router } from 'express';
import db from '../db.js';
import { getIO } from '../socket.js';
import { runTicket } from '../services/agentRunner.js';

const router = Router();

// GET / - list tickets with optional filters
router.get('/', (req, res) => {
  const { status, agent_id, goal_id } = req.query;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push('t.status = ?');
    params.push(status);
  }
  if (agent_id) {
    conditions.push('t.agent_id = ?');
    params.push(agent_id);
  }
  if (goal_id) {
    conditions.push('t.goal_id = ?');
    params.push(goal_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const tickets = db.prepare(`
    SELECT t.*, a.name AS agent_name, g.title AS goal_title
    FROM tickets t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN goals g ON t.goal_id = g.id
    ${whereClause}
    ORDER BY t.priority DESC, t.created_at DESC
  `).all(...params);

  res.json(tickets);
});

// POST / - create ticket
router.post('/', (req, res) => {
  const { goal_id, agent_id, title, description, priority, parent_id } = req.body;

  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  if (goal_id) {
    const goal = db.prepare(`SELECT id FROM goals WHERE id = ?`).get(goal_id);
    if (!goal) {
      res.status(400).json({ error: `Goal ${goal_id} not found` });
      return;
    }
  }

  if (agent_id) {
    const agent = db.prepare(`SELECT id FROM agents WHERE id = ?`).get(agent_id);
    if (!agent) {
      res.status(400).json({ error: `Agent ${agent_id} not found` });
      return;
    }
  }

  if (parent_id) {
    const parent = db.prepare(`SELECT id FROM tickets WHERE id = ?`).get(parent_id);
    if (!parent) {
      res.status(400).json({ error: `Parent ticket ${parent_id} not found` });
      return;
    }
  }

  const result = db.prepare(`
    INSERT INTO tickets (goal_id, agent_id, title, description, priority, parent_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(goal_id || null, agent_id || null, title, description || null, priority || 0, parent_id || null);

  const ticket = db.prepare(`
    SELECT t.*, a.name AS agent_name, g.title AS goal_title
    FROM tickets t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN goals g ON t.goal_id = g.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  try { getIO().emit('ticket:created', ticket); } catch { /* socket not ready */ }

  res.status(201).json(ticket);
});

// PATCH /:id - update ticket
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { goal_id, agent_id, title, description, status, priority, result, parent_id } = req.body;

  const existing = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (goal_id !== undefined) { fields.push('goal_id = ?'); values.push(goal_id); }
  if (agent_id !== undefined) { fields.push('agent_id = ?'); values.push(agent_id); }
  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }
  if (priority !== undefined) { fields.push('priority = ?'); values.push(priority); }
  if (result !== undefined) { fields.push('result = ?'); values.push(result); }
  if (parent_id !== undefined) { fields.push('parent_id = ?'); values.push(parent_id); }
  fields.push("updated_at = datetime('now')");

  if (fields.length === 1) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE tickets SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const ticket = db.prepare(`
    SELECT t.*, a.name AS agent_name, g.title AS goal_title
    FROM tickets t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN goals g ON t.goal_id = g.id
    WHERE t.id = ?
  `).get(id);

  try { getIO().emit('ticket:updated', ticket); } catch { /* socket not ready */ }

  res.json(ticket);
});

// POST /:id/run - run ticket via agent (returns immediately, streams via socket)
router.post('/:id/run', (req, res) => {
  const ticketId = Number(req.params.id);

  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticketId);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  // Fire and forget - runTicket handles everything async
  runTicket(ticketId).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[AgentRunner] Error running ticket ${ticketId}:`, message);
  });

  res.json({ message: `Ticket ${ticketId} execution started. Listen to socket events for progress.` });
});

export default router;
