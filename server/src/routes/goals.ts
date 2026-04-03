import { Router } from 'express';
import db from '../db.js';
import { getIO } from '../socket.js';
import { decomposeGoal } from '../services/orchestrator.js';

const router = Router();

// GET / - list all goals
router.get('/', (_req, res) => {
  const goals = db.prepare(`SELECT * FROM goals ORDER BY created_at DESC`).all();
  res.json(goals);
});

// POST / - create goal
router.post('/', (req, res) => {
  const { title, description } = req.body;
  if (!title) {
    res.status(400).json({ error: 'title is required' });
    return;
  }

  const result = db.prepare(
    `INSERT INTO goals (title, description) VALUES (?, ?)`
  ).run(title, description || null);

  const goal = db.prepare(`SELECT * FROM goals WHERE id = ?`).get(result.lastInsertRowid);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('goal_created', `New goal created: "${title}"`, JSON.stringify({ goalId: Number(result.lastInsertRowid) }));

  try { getIO().emit('goal:created', goal); } catch { /* socket not ready */ }

  res.status(201).json(goal);
});

// PATCH /:id - update goal
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, status } = req.body;

  const existing = db.prepare(`SELECT * FROM goals WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Goal not found' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }
  fields.push("updated_at = datetime('now')");

  if (fields.length === 1) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE goals SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const goal = db.prepare(`SELECT * FROM goals WHERE id = ?`).get(id);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('goal_updated', `Goal "${(goal as { title: string }).title}" updated`, JSON.stringify({ goalId: Number(id) }));

  try { getIO().emit('goal:updated', goal); } catch { /* socket not ready */ }

  res.json(goal);
});

// POST /:id/decompose - decompose goal into tickets
router.post('/:id/decompose', async (req, res) => {
  try {
    const tickets = await decomposeGoal(Number(req.params.id));
    res.json({ tickets });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});

export default router;
