import { Router } from 'express';
import db from '../db.js';
import { getIO } from '../socket.js';
import { fireTriggers } from '../services/triggerEngine.js';

const router = Router();

// ─── Schedules ─────────────────────────────────────────────────────

// GET /schedules - list all schedules
router.get('/schedules', (_req, res) => {
  const schedules = db.prepare(`
    SELECT s.*, a.name AS agent_name, g.title AS goal_title
    FROM schedules s
    LEFT JOIN agents a ON s.agent_id = a.id
    LEFT JOIN goals g ON s.goal_id = g.id
    ORDER BY s.created_at DESC
  `).all();

  res.json(schedules);
});

// POST /schedules - create a schedule
router.post('/schedules', (req, res) => {
  const { title, description, goal_id, agent_id, priority, cron_expression } = req.body;

  if (!title || !cron_expression) {
    res.status(400).json({ error: 'title and cron_expression are required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO schedules (title, description, goal_id, agent_id, priority, cron_expression, next_run)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    title,
    description || null,
    goal_id || null,
    agent_id || null,
    priority || 0,
    cron_expression,
    null // next_run set to null for MVP; a cron runner would compute this
  );

  const schedule = db.prepare(`
    SELECT s.*, a.name AS agent_name, g.title AS goal_title
    FROM schedules s
    LEFT JOIN agents a ON s.agent_id = a.id
    LEFT JOIN goals g ON s.goal_id = g.id
    WHERE s.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(schedule);
});

// PATCH /schedules/:id - update a schedule
router.patch('/schedules/:id', (req, res) => {
  const { id } = req.params;
  const { title, description, goal_id, agent_id, priority, cron_expression, enabled, next_run } = req.body;

  const existing = db.prepare(`SELECT id FROM schedules WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (goal_id !== undefined) { fields.push('goal_id = ?'); values.push(goal_id); }
  if (agent_id !== undefined) { fields.push('agent_id = ?'); values.push(agent_id); }
  if (priority !== undefined) { fields.push('priority = ?'); values.push(priority); }
  if (cron_expression !== undefined) { fields.push('cron_expression = ?'); values.push(cron_expression); }
  if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled); }
  if (next_run !== undefined) { fields.push('next_run = ?'); values.push(next_run); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE schedules SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const schedule = db.prepare(`
    SELECT s.*, a.name AS agent_name, g.title AS goal_title
    FROM schedules s
    LEFT JOIN agents a ON s.agent_id = a.id
    LEFT JOIN goals g ON s.goal_id = g.id
    WHERE s.id = ?
  `).get(id);

  res.json(schedule);
});

// DELETE /schedules/:id
router.delete('/schedules/:id', (req, res) => {
  const { id } = req.params;

  const existing = db.prepare(`SELECT id FROM schedules WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }

  db.prepare(`DELETE FROM schedules WHERE id = ?`).run(id);
  res.json({ message: 'Schedule deleted' });
});

// POST /schedules/:id/trigger - manually trigger a schedule
router.post('/schedules/:id/trigger', (req, res) => {
  const { id } = req.params;

  const schedule = db.prepare(`SELECT * FROM schedules WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!schedule) {
    res.status(404).json({ error: 'Schedule not found' });
    return;
  }

  // Create a ticket from the schedule template
  const ticketResult = db.prepare(`
    INSERT INTO tickets (goal_id, agent_id, title, description, priority, status)
    VALUES (?, ?, ?, ?, ?, 'todo')
  `).run(
    schedule.goal_id || null,
    schedule.agent_id || null,
    schedule.title as string,
    schedule.description || null,
    schedule.priority || 0
  );

  // Update last_run
  db.prepare(`UPDATE schedules SET last_run = datetime('now') WHERE id = ?`).run(id);

  const ticket = db.prepare(`
    SELECT t.*, a.name AS agent_name, g.title AS goal_title
    FROM tickets t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN goals g ON t.goal_id = g.id
    WHERE t.id = ?
  `).get(ticketResult.lastInsertRowid);

  try { getIO().emit('ticket:created', ticket); } catch { /* socket not ready */ }

  res.status(201).json(ticket);
});

// ─── Workflow Triggers ─────────────────────────────────────────────

// GET /triggers - list all triggers
router.get('/triggers', (_req, res) => {
  const triggers = db.prepare(`SELECT * FROM workflow_triggers ORDER BY created_at DESC`).all();
  res.json(triggers);
});

// POST /triggers - create a trigger
router.post('/triggers', (req, res) => {
  const { name, trigger_event, condition_config, action_config } = req.body;

  if (!name || !trigger_event || !action_config) {
    res.status(400).json({ error: 'name, trigger_event, and action_config are required' });
    return;
  }

  const validEvents = ['ticket_done', 'ticket_failed', 'ticket_review', 'budget_alert'];
  if (!validEvents.includes(trigger_event)) {
    res.status(400).json({ error: `trigger_event must be one of: ${validEvents.join(', ')}` });
    return;
  }

  const result = db.prepare(`
    INSERT INTO workflow_triggers (name, trigger_event, condition_config, action_config)
    VALUES (?, ?, ?, ?)
  `).run(
    name,
    trigger_event,
    condition_config ? JSON.stringify(condition_config) : null,
    JSON.stringify(action_config)
  );

  const trigger = db.prepare(`SELECT * FROM workflow_triggers WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json(trigger);
});

// PATCH /triggers/:id - update a trigger
router.patch('/triggers/:id', (req, res) => {
  const { id } = req.params;
  const { name, trigger_event, condition_config, action_config, enabled } = req.body;

  const existing = db.prepare(`SELECT id FROM workflow_triggers WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Trigger not found' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (trigger_event !== undefined) { fields.push('trigger_event = ?'); values.push(trigger_event); }
  if (condition_config !== undefined) { fields.push('condition_config = ?'); values.push(JSON.stringify(condition_config)); }
  if (action_config !== undefined) { fields.push('action_config = ?'); values.push(JSON.stringify(action_config)); }
  if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE workflow_triggers SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const trigger = db.prepare(`SELECT * FROM workflow_triggers WHERE id = ?`).get(id);
  res.json(trigger);
});

// DELETE /triggers/:id
router.delete('/triggers/:id', (req, res) => {
  const { id } = req.params;

  const existing = db.prepare(`SELECT id FROM workflow_triggers WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Trigger not found' });
    return;
  }

  db.prepare(`DELETE FROM workflow_triggers WHERE id = ?`).run(id);
  res.json({ message: 'Trigger deleted' });
});

// ─── Autopilot ─────────────────────────────────────────────────────

// POST /autopilot/:goalId - toggle autopilot on a goal
router.post('/autopilot/:goalId', (req, res) => {
  const { goalId } = req.params;

  const goal = db.prepare(`SELECT * FROM goals WHERE id = ?`).get(goalId) as Record<string, unknown> | undefined;
  if (!goal) {
    res.status(404).json({ error: 'Goal not found' });
    return;
  }

  const newValue = goal.autopilot === 1 ? 0 : 1;
  db.prepare(`UPDATE goals SET autopilot = ?, updated_at = datetime('now') WHERE id = ?`).run(newValue, goalId);

  const updated = db.prepare(`SELECT * FROM goals WHERE id = ?`).get(goalId);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('autopilot_toggled', `Autopilot ${newValue ? 'enabled' : 'disabled'} for goal "${goal.title}"`, JSON.stringify({ goalId: Number(goalId), autopilot: newValue }));

  try { getIO().emit('goal:updated', updated); } catch { /* socket not ready */ }

  res.json(updated);
});

// Export fireTriggers for use elsewhere
export { fireTriggers };

export default router;
