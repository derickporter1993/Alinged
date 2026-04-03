import { Router } from 'express';
import db from '../db.js';
import { getIO } from '../socket.js';
import { fireWebhooks } from '../services/webhookService.js';

const router = Router();

// ─── Interfaces ───────────────────────────────────────────────

interface WebhookRow {
  id: number;
  name: string;
  url: string;
  events: string;
  secret: string | null;
  enabled: number;
  created_at: string;
}

interface AgentToolRow {
  id: number;
  agent_id: number;
  tool_type: string;
  config: string | null;
  enabled: number;
  created_at: string;
}

interface GoalRow {
  id: number;
  title: string;
  description: string | null;
  status: string;
  autopilot: number;
  created_at: string;
  updated_at: string;
}

interface TicketRow {
  id: number;
  goal_id: number | null;
  agent_id: number | null;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  result: string | null;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
}

interface AgentRow {
  id: number;
  name: string;
  role: string;
  provider_id: number;
  model: string;
  system_prompt: string | null;
  reports_to: number | null;
  status: string;
  budget_limit: number;
  budget_spent: number;
  requires_approval: number;
  created_at: string;
}

// ═══════════════════════════════════════════════════════════════
//  WEBHOOKS
// ═══════════════════════════════════════════════════════════════

// ─── GET /webhooks ────────────────────────────────────────────

router.get('/webhooks', (_req, res) => {
  const rows = db.prepare(`SELECT * FROM webhooks ORDER BY created_at DESC`).all() as WebhookRow[];
  const masked = rows.map((wh) => ({
    ...wh,
    secret: wh.secret ? '****' + wh.secret.slice(-4) : null,
  }));
  res.json(masked);
});

// ─── POST /webhooks ───────────────────────────────────────────

router.post('/webhooks', (req, res) => {
  const { name, url, events, secret } = req.body;

  if (!name || !url || !events) {
    res.status(400).json({ error: 'name, url, and events are required' });
    return;
  }

  const eventsStr = Array.isArray(events) ? events.join(',') : events;

  const result = db.prepare(
    `INSERT INTO webhooks (name, url, events, secret) VALUES (?, ?, ?, ?)`
  ).run(name, url, eventsStr, secret || null);

  const webhook = db.prepare(`SELECT * FROM webhooks WHERE id = ?`).get(result.lastInsertRowid) as WebhookRow;

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('webhook_created', `Webhook "${name}" created`, JSON.stringify({ webhook_id: webhook.id }));

  res.status(201).json({
    ...webhook,
    secret: webhook.secret ? '****' + webhook.secret.slice(-4) : null,
  });
});

// ─── PATCH /webhooks/:id ──────────────────────────────────────

router.patch('/webhooks/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM webhooks WHERE id = ?`).get(id) as WebhookRow | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  const { name, url, events, secret, enabled } = req.body;
  const eventsStr = events ? (Array.isArray(events) ? events.join(',') : events) : undefined;

  db.prepare(`
    UPDATE webhooks SET
      name = COALESCE(?, name),
      url = COALESCE(?, url),
      events = COALESCE(?, events),
      secret = COALESCE(?, secret),
      enabled = COALESCE(?, enabled)
    WHERE id = ?
  `).run(
    name ?? null,
    url ?? null,
    eventsStr ?? null,
    secret ?? null,
    enabled !== undefined ? (enabled ? 1 : 0) : null,
    id
  );

  const updated = db.prepare(`SELECT * FROM webhooks WHERE id = ?`).get(id) as WebhookRow;
  res.json({
    ...updated,
    secret: updated.secret ? '****' + updated.secret.slice(-4) : null,
  });
});

// ─── DELETE /webhooks/:id ─────────────────────────────────────

router.delete('/webhooks/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM webhooks WHERE id = ?`).get(id) as WebhookRow | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  db.prepare(`DELETE FROM webhooks WHERE id = ?`).run(id);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('webhook_deleted', `Webhook "${existing.name}" deleted`, JSON.stringify({ webhook_id: id }));

  res.json({ success: true });
});

// ─── POST /webhooks/test/:id ──────────────────────────────────

router.post('/webhooks/test/:id', async (req, res) => {
  const id = Number(req.params.id);
  const webhook = db.prepare(`SELECT * FROM webhooks WHERE id = ?`).get(id) as WebhookRow | undefined;
  if (!webhook) {
    res.status(404).json({ error: 'Webhook not found' });
    return;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (webhook.secret) {
    headers['X-Webhook-Secret'] = webhook.secret;
  }

  const testPayload = {
    event: 'test',
    payload: { message: 'This is a test webhook from HiveMind', webhook_id: id },
    timestamp: new Date().toISOString(),
  };

  try {
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(testPayload),
      signal: AbortSignal.timeout(10000),
    });

    db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
      .run('webhook_test', `Test webhook "${webhook.name}" sent (status: ${response.status})`, JSON.stringify({ webhook_id: id, status: response.status }));

    res.json({ success: response.ok, status: response.status, statusText: response.statusText });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    res.json({ success: false, error: message });
  }
});

// ═══════════════════════════════════════════════════════════════
//  AGENT TOOLS
// ═══════════════════════════════════════════════════════════════

// ─── GET /tools ───────────────────────────────────────────────

router.get('/tools', (req, res) => {
  const agentId = req.query.agent_id ? Number(req.query.agent_id) : null;

  let query = `SELECT at.*, a.name AS agent_name FROM agent_tools at JOIN agents a ON a.id = at.agent_id`;
  const params: unknown[] = [];

  if (agentId) {
    query += ` WHERE at.agent_id = ?`;
    params.push(agentId);
  }

  query += ` ORDER BY at.created_at DESC`;
  const rows = db.prepare(query).all(...params);
  res.json(rows);
});

// ─── POST /tools ──────────────────────────────────────────────

router.post('/tools', (req, res) => {
  const { agent_id, tool_type, config } = req.body;

  if (!agent_id || !tool_type) {
    res.status(400).json({ error: 'agent_id and tool_type are required' });
    return;
  }

  const validTypes = ['web_search', 'file_io', 'api_call', 'code_exec'];
  if (!validTypes.includes(tool_type)) {
    res.status(400).json({ error: `tool_type must be one of: ${validTypes.join(', ')}` });
    return;
  }

  const agent = db.prepare(`SELECT id FROM agents WHERE id = ?`).get(agent_id);
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const configStr = config ? (typeof config === 'string' ? config : JSON.stringify(config)) : null;

  const result = db.prepare(
    `INSERT INTO agent_tools (agent_id, tool_type, config) VALUES (?, ?, ?)`
  ).run(agent_id, tool_type, configStr);

  const tool = db.prepare(`SELECT * FROM agent_tools WHERE id = ?`).get(result.lastInsertRowid);
  res.status(201).json(tool);
});

// ─── PATCH /tools/:id ─────────────────────────────────────────

router.patch('/tools/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM agent_tools WHERE id = ?`).get(id) as AgentToolRow | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Tool not found' });
    return;
  }

  const { config, enabled } = req.body;
  const configStr = config !== undefined ? (typeof config === 'string' ? config : JSON.stringify(config)) : null;

  db.prepare(`
    UPDATE agent_tools SET
      config = COALESCE(?, config),
      enabled = COALESCE(?, enabled)
    WHERE id = ?
  `).run(
    configStr,
    enabled !== undefined ? (enabled ? 1 : 0) : null,
    id
  );

  const updated = db.prepare(`SELECT * FROM agent_tools WHERE id = ?`).get(id);
  res.json(updated);
});

// ─── DELETE /tools/:id ────────────────────────────────────────

router.delete('/tools/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM agent_tools WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Tool not found' });
    return;
  }

  db.prepare(`DELETE FROM agent_tools WHERE id = ?`).run(id);
  res.json({ success: true });
});

// ─── GET /tools/agent/:agentId ────────────────────────────────

router.get('/tools/agent/:agentId', (req, res) => {
  const agentId = Number(req.params.agentId);
  const tools = db.prepare(
    `SELECT * FROM agent_tools WHERE agent_id = ? AND enabled = 1 ORDER BY created_at DESC`
  ).all(agentId);
  res.json(tools);
});

// ═══════════════════════════════════════════════════════════════
//  IMPORT / EXPORT
// ═══════════════════════════════════════════════════════════════

// ─── GET /export/goals ────────────────────────────────────────

router.get('/export/goals', (_req, res) => {
  const goals = db.prepare(`SELECT * FROM goals ORDER BY id`).all() as GoalRow[];
  const exported = goals.map((goal) => {
    const tickets = db.prepare(`SELECT * FROM tickets WHERE goal_id = ? ORDER BY id`).all(goal.id) as TicketRow[];
    return { ...goal, tickets };
  });
  res.json(exported);
});

// ─── GET /export/agents ───────────────────────────────────────

router.get('/export/agents', (_req, res) => {
  const agents = db.prepare(`SELECT * FROM agents ORDER BY id`).all() as AgentRow[];
  res.json(agents);
});

// ─── POST /import/goals ───────────────────────────────────────

router.post('/import/goals', (req, res) => {
  const goalsData = req.body;

  if (!Array.isArray(goalsData)) {
    res.status(400).json({ error: 'Request body must be a JSON array of goals' });
    return;
  }

  let goalsCreated = 0;
  let ticketsCreated = 0;

  const insertGoal = db.prepare(
    `INSERT INTO goals (title, description, status, autopilot) VALUES (?, ?, ?, ?)`
  );
  const insertTicket = db.prepare(
    `INSERT INTO tickets (goal_id, title, description, status, priority) VALUES (?, ?, ?, ?, ?)`
  );

  const importAll = db.transaction(() => {
    for (const goalData of goalsData) {
      const { title, description, status, autopilot, tickets } = goalData;
      if (!title) continue;

      const result = insertGoal.run(
        title,
        description || null,
        status || 'active',
        autopilot ? 1 : 0
      );
      goalsCreated++;

      if (Array.isArray(tickets)) {
        for (const ticketData of tickets) {
          if (!ticketData.title) continue;
          insertTicket.run(
            result.lastInsertRowid,
            ticketData.title,
            ticketData.description || null,
            ticketData.status || 'backlog',
            ticketData.priority || 0
          );
          ticketsCreated++;
        }
      }
    }
  });

  importAll();

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('goals_imported', `Imported ${goalsCreated} goals and ${ticketsCreated} tickets`, JSON.stringify({ goalsCreated, ticketsCreated }));

  try {
    const io = getIO();
    io.emit('goals:imported', { goalsCreated, ticketsCreated });
  } catch { /* socket not ready */ }

  res.status(201).json({ goalsCreated, ticketsCreated });
});

// ─── POST /import/agents ──────────────────────────────────────

router.post('/import/agents', (req, res) => {
  const agentsData = req.body;

  if (!Array.isArray(agentsData)) {
    res.status(400).json({ error: 'Request body must be a JSON array of agents' });
    return;
  }

  let agentsCreated = 0;

  const insertAgent = db.prepare(
    `INSERT INTO agents (name, role, provider_id, model, system_prompt, reports_to, status, budget_limit, requires_approval)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const importAll = db.transaction(() => {
    for (const agentData of agentsData) {
      const { name, role, provider_id, model } = agentData;
      if (!name || !role || !provider_id || !model) continue;

      // Validate provider exists
      const provider = db.prepare(`SELECT id FROM providers WHERE id = ?`).get(provider_id);
      if (!provider) continue;

      insertAgent.run(
        name,
        role,
        provider_id,
        model,
        agentData.system_prompt || null,
        agentData.reports_to || null,
        agentData.status || 'idle',
        agentData.budget_limit || 0,
        agentData.requires_approval ? 1 : 0
      );
      agentsCreated++;
    }
  });

  importAll();

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('agents_imported', `Imported ${agentsCreated} agents`, JSON.stringify({ agentsCreated }));

  try {
    const io = getIO();
    io.emit('agents:imported', { agentsCreated });
  } catch { /* socket not ready */ }

  res.status(201).json({ agentsCreated });
});

export default router;
