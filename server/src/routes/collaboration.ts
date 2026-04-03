import { Router } from 'express';
import db from '../db.js';
import { getIO } from '../socket.js';

const router = Router();

// ─── Agent Messages ────────────────────────────────────────────────

// GET /messages - list messages with optional filters
router.get('/messages', (req, res) => {
  const { agent_id, ticket_id } = req.query;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (agent_id) {
    conditions.push('(m.from_agent_id = ? OR m.to_agent_id = ?)');
    params.push(agent_id, agent_id);
  }
  if (ticket_id) {
    conditions.push('m.ticket_id = ?');
    params.push(ticket_id);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const messages = db.prepare(`
    SELECT m.*,
           fa.name AS from_agent_name,
           ta.name AS to_agent_name
    FROM agent_messages m
    LEFT JOIN agents fa ON m.from_agent_id = fa.id
    LEFT JOIN agents ta ON m.to_agent_id = ta.id
    ${whereClause}
    ORDER BY m.created_at DESC
  `).all(...params);

  res.json(messages);
});

// POST /messages - create a message
router.post('/messages', (req, res) => {
  const { from_agent_id, to_agent_id, ticket_id, content } = req.body;

  if (!from_agent_id || !to_agent_id || !content) {
    res.status(400).json({ error: 'from_agent_id, to_agent_id, and content are required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO agent_messages (from_agent_id, to_agent_id, ticket_id, content)
    VALUES (?, ?, ?, ?)
  `).run(from_agent_id, to_agent_id, ticket_id || null, content);

  const message = db.prepare(`
    SELECT m.*,
           fa.name AS from_agent_name,
           ta.name AS to_agent_name
    FROM agent_messages m
    LEFT JOIN agents fa ON m.from_agent_id = fa.id
    LEFT JOIN agents ta ON m.to_agent_id = ta.id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('message_sent', `Agent message sent`, JSON.stringify({ messageId: Number(result.lastInsertRowid), from_agent_id, to_agent_id }));

  try { getIO().emit('message:new', message); } catch { /* socket not ready */ }

  res.status(201).json(message);
});

// POST /messages/delegate - delegate a sub-task to another agent
router.post('/messages/delegate', (req, res) => {
  const { from_agent_id, to_agent_id, ticket_id } = req.body;

  if (!from_agent_id || !to_agent_id || !ticket_id) {
    res.status(400).json({ error: 'from_agent_id, to_agent_id, and ticket_id are required' });
    return;
  }

  const parentTicket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticket_id) as Record<string, unknown> | undefined;
  if (!parentTicket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  // Create a child ticket assigned to the delegate agent
  const childResult = db.prepare(`
    INSERT INTO tickets (goal_id, agent_id, title, description, priority, parent_id, status)
    VALUES (?, ?, ?, ?, ?, ?, 'todo')
  `).run(
    parentTicket.goal_id || null,
    to_agent_id,
    `[Delegated] ${parentTicket.title}`,
    parentTicket.description || null,
    parentTicket.priority || 0,
    ticket_id
  );

  const childTicket = db.prepare(`
    SELECT t.*, a.name AS agent_name, g.title AS goal_title
    FROM tickets t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN goals g ON t.goal_id = g.id
    WHERE t.id = ?
  `).get(childResult.lastInsertRowid);

  // Send a message explaining the delegation
  const fromAgent = db.prepare(`SELECT name FROM agents WHERE id = ?`).get(from_agent_id) as { name: string } | undefined;
  const toAgent = db.prepare(`SELECT name FROM agents WHERE id = ?`).get(to_agent_id) as { name: string } | undefined;
  const delegationContent = `Delegated sub-task "${parentTicket.title}" from ${fromAgent?.name || 'unknown'} to ${toAgent?.name || 'unknown'}. Child ticket #${childResult.lastInsertRowid} created.`;

  db.prepare(`
    INSERT INTO agent_messages (from_agent_id, to_agent_id, ticket_id, content)
    VALUES (?, ?, ?, ?)
  `).run(from_agent_id, to_agent_id, ticket_id, delegationContent);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('task_delegated', delegationContent, JSON.stringify({ parentTicketId: ticket_id, childTicketId: Number(childResult.lastInsertRowid), from_agent_id, to_agent_id }));

  try {
    getIO().emit('ticket:created', childTicket);
    getIO().emit('message:new', { from_agent_id, to_agent_id, ticket_id, content: delegationContent });
  } catch { /* socket not ready */ }

  res.status(201).json(childTicket);
});

// ─── Review Chains ─────────────────────────────────────────────────

// GET /review-chains - list all review chains
router.get('/review-chains', (_req, res) => {
  const chains = db.prepare(`SELECT * FROM review_chains ORDER BY created_at DESC`).all();
  res.json(chains);
});

// POST /review-chains - create a review chain
router.post('/review-chains', (req, res) => {
  const { name, steps } = req.body;

  if (!name || !steps || !Array.isArray(steps)) {
    res.status(400).json({ error: 'name and steps (array) are required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO review_chains (name, steps) VALUES (?, ?)
  `).run(name, JSON.stringify(steps));

  const chain = db.prepare(`SELECT * FROM review_chains WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json(chain);
});

// POST /review-chains/:id/run - run a review chain on a ticket
router.post('/review-chains/:id/run', (req, res) => {
  const { id } = req.params;
  const { ticket_id } = req.body;

  if (!ticket_id) {
    res.status(400).json({ error: 'ticket_id is required' });
    return;
  }

  const chain = db.prepare(`SELECT * FROM review_chains WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  if (!chain) {
    res.status(404).json({ error: 'Review chain not found' });
    return;
  }

  const sourceTicket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticket_id) as Record<string, unknown> | undefined;
  if (!sourceTicket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  const steps = JSON.parse(chain.steps as string) as Array<{ agent_id: number; role: string; order: number }>;
  const sortedSteps = steps.sort((a, b) => a.order - b.order);

  const createdTickets: unknown[] = [];
  let previousContext = sourceTicket.result || sourceTicket.description || '';

  for (const step of sortedSteps) {
    const reviewResult = db.prepare(`
      INSERT INTO tickets (goal_id, agent_id, title, description, priority, parent_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'todo')
    `).run(
      sourceTicket.goal_id || null,
      step.agent_id,
      `[Review: ${step.role}] ${sourceTicket.title}`,
      `Review step (${step.role}) for ticket #${ticket_id}.\n\nContext from previous step:\n${previousContext}`,
      sourceTicket.priority || 0,
      ticket_id
    );

    const reviewTicket = db.prepare(`
      SELECT t.*, a.name AS agent_name, g.title AS goal_title
      FROM tickets t
      LEFT JOIN agents a ON t.agent_id = a.id
      LEFT JOIN goals g ON t.goal_id = g.id
      WHERE t.id = ?
    `).get(reviewResult.lastInsertRowid);

    createdTickets.push(reviewTicket);
    previousContext = `Awaiting output from ${step.role} review (ticket #${reviewResult.lastInsertRowid})`;

    try { getIO().emit('ticket:created', reviewTicket); } catch { /* socket not ready */ }
  }

  res.status(201).json({ chain_id: Number(id), ticket_id, tickets: createdTickets });
});

// DELETE /review-chains/:id
router.delete('/review-chains/:id', (req, res) => {
  const { id } = req.params;

  const existing = db.prepare(`SELECT id FROM review_chains WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Review chain not found' });
    return;
  }

  db.prepare(`DELETE FROM review_chains WHERE id = ?`).run(id);
  res.json({ message: 'Review chain deleted' });
});

// ─── Knowledge Base ────────────────────────────────────────────────

// GET /knowledge - list entries with optional filters
router.get('/knowledge', (req, res) => {
  const { tags, search } = req.query;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (tags) {
    const tagList = (tags as string).split(',').map(t => t.trim());
    const tagConditions = tagList.map(() => `k.tags LIKE ?`);
    conditions.push(`(${tagConditions.join(' OR ')})`);
    tagList.forEach(tag => params.push(`%${tag}%`));
  }

  if (search) {
    conditions.push('(k.title LIKE ? OR k.content LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const entries = db.prepare(`
    SELECT k.*, a.name AS author_name
    FROM knowledge_base k
    LEFT JOIN agents a ON k.author_agent_id = a.id
    ${whereClause}
    ORDER BY k.updated_at DESC
  `).all(...params);

  res.json(entries);
});

// POST /knowledge - create an entry
router.post('/knowledge', (req, res) => {
  const { title, content, author_agent_id, tags } = req.body;

  if (!title || !content) {
    res.status(400).json({ error: 'title and content are required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO knowledge_base (title, content, author_agent_id, tags)
    VALUES (?, ?, ?, ?)
  `).run(title, content, author_agent_id || null, tags || null);

  const entry = db.prepare(`
    SELECT k.*, a.name AS author_name
    FROM knowledge_base k
    LEFT JOIN agents a ON k.author_agent_id = a.id
    WHERE k.id = ?
  `).get(result.lastInsertRowid);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('knowledge_created', `Knowledge base entry created: "${title}"`, JSON.stringify({ entryId: Number(result.lastInsertRowid) }));

  res.status(201).json(entry);
});

// PATCH /knowledge/:id - update an entry
router.patch('/knowledge/:id', (req, res) => {
  const { id } = req.params;
  const { title, content, author_agent_id, tags } = req.body;

  const existing = db.prepare(`SELECT id FROM knowledge_base WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Knowledge entry not found' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (content !== undefined) { fields.push('content = ?'); values.push(content); }
  if (author_agent_id !== undefined) { fields.push('author_agent_id = ?'); values.push(author_agent_id); }
  if (tags !== undefined) { fields.push('tags = ?'); values.push(tags); }
  fields.push("updated_at = datetime('now')");

  if (fields.length === 1) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE knowledge_base SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const entry = db.prepare(`
    SELECT k.*, a.name AS author_name
    FROM knowledge_base k
    LEFT JOIN agents a ON k.author_agent_id = a.id
    WHERE k.id = ?
  `).get(id);

  res.json(entry);
});

// DELETE /knowledge/:id
router.delete('/knowledge/:id', (req, res) => {
  const { id } = req.params;

  const existing = db.prepare(`SELECT id FROM knowledge_base WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Knowledge entry not found' });
    return;
  }

  db.prepare(`DELETE FROM knowledge_base WHERE id = ?`).run(id);
  res.json({ message: 'Knowledge entry deleted' });
});

export default router;
