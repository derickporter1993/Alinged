import { Router } from 'express';
import db from '../db.js';
import { getIO } from '../socket.js';

const router = Router();

// ─── Checkpoints ──────────────────────────────────────────────────

// GET /checkpoints - list checkpoints with optional status filter
router.get('/checkpoints', (req, res) => {
  const { status } = req.query;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    conditions.push('c.status = ?');
    params.push(status);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const checkpoints = db.prepare(`
    SELECT c.*, t.title AS ticket_title, a.name AS agent_name
    FROM checkpoints c
    LEFT JOIN tickets t ON c.ticket_id = t.id
    LEFT JOIN agents a ON c.agent_id = a.id
    ${whereClause}
    ORDER BY c.created_at DESC
  `).all(...params);

  res.json(checkpoints);
});

// POST /checkpoints - create a checkpoint
router.post('/checkpoints', (req, res) => {
  const { ticket_id, agent_id, output_preview } = req.body;

  if (!ticket_id || !agent_id) {
    res.status(400).json({ error: 'ticket_id and agent_id are required' });
    return;
  }

  // Set ticket status to 'review'
  db.prepare(`UPDATE tickets SET status = 'review', updated_at = datetime('now') WHERE id = ?`).run(ticket_id);

  const result = db.prepare(`
    INSERT INTO checkpoints (ticket_id, agent_id, output_preview)
    VALUES (?, ?, ?)
  `).run(ticket_id, agent_id, output_preview || null);

  const checkpoint = db.prepare(`
    SELECT c.*, t.title AS ticket_title, a.name AS agent_name
    FROM checkpoints c
    LEFT JOIN tickets t ON c.ticket_id = t.id
    LEFT JOIN agents a ON c.agent_id = a.id
    WHERE c.id = ?
  `).get(result.lastInsertRowid);

  try {
    getIO().emit('checkpoint:new', checkpoint);
    getIO().emit('ticket:updated', db.prepare(`
      SELECT t.*, a.name AS agent_name, g.title AS goal_title
      FROM tickets t
      LEFT JOIN agents a ON t.agent_id = a.id
      LEFT JOIN goals g ON t.goal_id = g.id
      WHERE t.id = ?
    `).get(ticket_id));
  } catch { /* socket not ready */ }

  res.status(201).json(checkpoint);
});

// PATCH /checkpoints/:id - approve or reject a checkpoint
router.patch('/checkpoints/:id', (req, res) => {
  const { id } = req.params;
  const { status, reviewer_notes } = req.body;

  if (!status || !['approved', 'rejected'].includes(status)) {
    res.status(400).json({ error: "status must be 'approved' or 'rejected'" });
    return;
  }

  const existing = db.prepare(`SELECT * FROM checkpoints WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Checkpoint not found' });
    return;
  }

  // Update the checkpoint
  const fields: string[] = ['status = ?', "resolved_at = datetime('now')"];
  const values: unknown[] = [status];

  if (reviewer_notes !== undefined) {
    fields.push('reviewer_notes = ?');
    values.push(reviewer_notes);
  }

  values.push(id);
  db.prepare(`UPDATE checkpoints SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  // Update the ticket status based on approval/rejection
  const newTicketStatus = status === 'approved' ? 'done' : 'todo';
  db.prepare(`UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(newTicketStatus, existing.ticket_id);

  const checkpoint = db.prepare(`
    SELECT c.*, t.title AS ticket_title, a.name AS agent_name
    FROM checkpoints c
    LEFT JOIN tickets t ON c.ticket_id = t.id
    LEFT JOIN agents a ON c.agent_id = a.id
    WHERE c.id = ?
  `).get(id);

  const ticket = db.prepare(`
    SELECT t.*, a.name AS agent_name, g.title AS goal_title
    FROM tickets t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN goals g ON t.goal_id = g.id
    WHERE t.id = ?
  `).get(existing.ticket_id);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run(
      `checkpoint_${status}`,
      `Checkpoint ${status} for ticket #${existing.ticket_id}${reviewer_notes ? `: ${reviewer_notes}` : ''}`,
      JSON.stringify({ checkpointId: Number(id), ticketId: existing.ticket_id, status })
    );

  try {
    getIO().emit('checkpoint:updated', checkpoint);
    getIO().emit('ticket:updated', ticket);
  } catch { /* socket not ready */ }

  res.json(checkpoint);
});

// ─── Validation Rules ─────────────────────────────────────────────

// GET /validation-rules - list all rules
router.get('/validation-rules', (_req, res) => {
  const rules = db.prepare(`
    SELECT vr.*, a.name AS agent_name
    FROM validation_rules vr
    LEFT JOIN agents a ON vr.agent_id = a.id
    ORDER BY vr.created_at DESC
  `).all();

  res.json(rules);
});

// POST /validation-rules - create a rule
router.post('/validation-rules', (req, res) => {
  const { name, agent_id, rule_type, rule_config } = req.body;

  if (!name || !rule_type || !rule_config) {
    res.status(400).json({ error: 'name, rule_type, and rule_config are required' });
    return;
  }

  const validTypes = ['regex', 'min_length', 'max_length', 'json_schema', 'contains', 'not_contains'];
  if (!validTypes.includes(rule_type)) {
    res.status(400).json({ error: `rule_type must be one of: ${validTypes.join(', ')}` });
    return;
  }

  const result = db.prepare(`
    INSERT INTO validation_rules (name, agent_id, rule_type, rule_config)
    VALUES (?, ?, ?, ?)
  `).run(name, agent_id || null, rule_type, JSON.stringify(rule_config));

  const rule = db.prepare(`
    SELECT vr.*, a.name AS agent_name
    FROM validation_rules vr
    LEFT JOIN agents a ON vr.agent_id = a.id
    WHERE vr.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(rule);
});

// PATCH /validation-rules/:id - update a rule
router.patch('/validation-rules/:id', (req, res) => {
  const { id } = req.params;
  const { name, agent_id, rule_type, rule_config, enabled } = req.body;

  const existing = db.prepare(`SELECT id FROM validation_rules WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Validation rule not found' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (agent_id !== undefined) { fields.push('agent_id = ?'); values.push(agent_id); }
  if (rule_type !== undefined) { fields.push('rule_type = ?'); values.push(rule_type); }
  if (rule_config !== undefined) { fields.push('rule_config = ?'); values.push(JSON.stringify(rule_config)); }
  if (enabled !== undefined) { fields.push('enabled = ?'); values.push(enabled); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE validation_rules SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const rule = db.prepare(`
    SELECT vr.*, a.name AS agent_name
    FROM validation_rules vr
    LEFT JOIN agents a ON vr.agent_id = a.id
    WHERE vr.id = ?
  `).get(id);

  res.json(rule);
});

// DELETE /validation-rules/:id
router.delete('/validation-rules/:id', (req, res) => {
  const { id } = req.params;

  const existing = db.prepare(`SELECT id FROM validation_rules WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Validation rule not found' });
    return;
  }

  db.prepare(`DELETE FROM validation_rules WHERE id = ?`).run(id);
  res.json({ message: 'Validation rule deleted' });
});

// POST /validate - validate text against rules
router.post('/validate', (req, res) => {
  const { agent_id, text } = req.body;

  if (text === undefined || text === null) {
    res.status(400).json({ error: 'text is required' });
    return;
  }

  const conditions: string[] = ['vr.enabled = 1'];
  const params: unknown[] = [];

  if (agent_id) {
    conditions.push('(vr.agent_id = ? OR vr.agent_id IS NULL)');
    params.push(agent_id);
  }

  const whereClause = `WHERE ${conditions.join(' AND ')}`;

  const rules = db.prepare(`
    SELECT vr.*
    FROM validation_rules vr
    ${whereClause}
    ORDER BY vr.created_at ASC
  `).all(...params) as Array<{
    id: number;
    name: string;
    rule_type: string;
    rule_config: string;
  }>;

  const results: Array<{ rule_id: number; rule_name: string; passed: boolean; message: string }> = [];
  let allValid = true;

  for (const rule of rules) {
    const config = JSON.parse(rule.rule_config) as Record<string, unknown>;
    let passed = false;
    let message = '';

    switch (rule.rule_type) {
      case 'regex': {
        try {
          const regex = new RegExp(config.pattern as string);
          passed = regex.test(text);
          message = passed ? 'Pattern matched' : `Pattern /${config.pattern}/ did not match`;
        } catch (err) {
          passed = false;
          message = `Invalid regex pattern: ${err instanceof Error ? err.message : String(err)}`;
        }
        break;
      }

      case 'min_length': {
        const min = config.min as number;
        passed = text.length >= min;
        message = passed ? `Length ${text.length} meets minimum ${min}` : `Length ${text.length} is below minimum ${min}`;
        break;
      }

      case 'max_length': {
        const max = config.max as number;
        passed = text.length <= max;
        message = passed ? `Length ${text.length} is within maximum ${max}` : `Length ${text.length} exceeds maximum ${max}`;
        break;
      }

      case 'contains': {
        const value = config.value as string;
        passed = text.includes(value);
        message = passed ? `Text contains "${value}"` : `Text does not contain "${value}"`;
        break;
      }

      case 'not_contains': {
        const value = config.value as string;
        passed = !text.includes(value);
        message = passed ? `Text does not contain "${value}"` : `Text contains forbidden "${value}"`;
        break;
      }

      case 'json_schema': {
        try {
          JSON.parse(text);
          passed = true;
          message = 'Valid JSON';
        } catch {
          passed = false;
          message = 'Invalid JSON';
        }
        break;
      }

      default:
        message = `Unknown rule type: ${rule.rule_type}`;
        break;
    }

    if (!passed) allValid = false;

    results.push({
      rule_id: rule.id,
      rule_name: rule.name,
      passed,
      message,
    });
  }

  res.json({ valid: allValid, results });
});

// ─── Ticket Versions ──────────────────────────────────────────────

// GET /versions/:ticketId - list all versions for a ticket
router.get('/versions/:ticketId', (req, res) => {
  const { ticketId } = req.params;

  const versions = db.prepare(`
    SELECT tv.*, a.name AS agent_name
    FROM ticket_versions tv
    LEFT JOIN agents a ON tv.agent_id = a.id
    WHERE tv.ticket_id = ?
    ORDER BY tv.version_number DESC
  `).all(ticketId);

  res.json(versions);
});

// POST /versions/:ticketId/rollback/:versionId - rollback to a specific version
router.post('/versions/:ticketId/rollback/:versionId', (req, res) => {
  const { ticketId, versionId } = req.params;

  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticketId) as Record<string, unknown> | undefined;
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const version = db.prepare(`SELECT * FROM ticket_versions WHERE id = ? AND ticket_id = ?`).get(versionId, ticketId) as Record<string, unknown> | undefined;
  if (!version) {
    res.status(404).json({ error: 'Version not found for this ticket' });
    return;
  }

  // Copy the version's result into the ticket
  db.prepare(`UPDATE tickets SET result = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(version.result, ticketId);

  // Determine the next version number
  const maxVersion = db.prepare(`SELECT MAX(version_number) AS max_v FROM ticket_versions WHERE ticket_id = ?`).get(ticketId) as { max_v: number | null };
  const nextVersion = (maxVersion.max_v || 0) + 1;

  // Create a new version entry for the rollback
  db.prepare(`
    INSERT INTO ticket_versions (ticket_id, version_number, result, agent_id)
    VALUES (?, ?, ?, ?)
  `).run(ticketId, nextVersion, version.result, version.agent_id || null);

  const updatedTicket = db.prepare(`
    SELECT t.*, a.name AS agent_name, g.title AS goal_title
    FROM tickets t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN goals g ON t.goal_id = g.id
    WHERE t.id = ?
  `).get(ticketId);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('version_rollback', `Ticket #${ticketId} rolled back to version ${version.version_number}`, JSON.stringify({ ticketId: Number(ticketId), versionId: Number(versionId), newVersion: nextVersion }));

  try { getIO().emit('ticket:updated', updatedTicket); } catch { /* socket not ready */ }

  res.json(updatedTicket);
});

export default router;
