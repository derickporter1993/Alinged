import { Router } from 'express';
import db from '../db.js';
import { getIO } from '../socket.js';

const router = Router();

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
  created_at: string;
  provider_name?: string;
}

interface TreeNode extends AgentRow {
  children: TreeNode[];
}

// GET / - list agents
router.get('/', (req, res) => {
  const tree = req.query.tree === 'true';

  if (tree) {
    const agents = db.prepare(`
      WITH RECURSIVE agent_tree AS (
        SELECT a.*, p.name AS provider_name, 0 AS depth
        FROM agents a
        LEFT JOIN providers p ON a.provider_id = p.id
        WHERE a.reports_to IS NULL AND a.status != 'terminated'

        UNION ALL

        SELECT a.*, p.name AS provider_name, at.depth + 1
        FROM agents a
        LEFT JOIN providers p ON a.provider_id = p.id
        JOIN agent_tree at ON a.reports_to = at.id
        WHERE a.status != 'terminated'
      )
      SELECT * FROM agent_tree ORDER BY depth, id
    `).all() as (AgentRow & { depth: number })[];

    // Build tree structure
    const nodeMap = new Map<number, TreeNode>();
    const roots: TreeNode[] = [];

    for (const agent of agents) {
      const node: TreeNode = { ...agent, children: [] };
      nodeMap.set(agent.id, node);
    }

    for (const agent of agents) {
      const node = nodeMap.get(agent.id)!;
      if (agent.reports_to === null) {
        roots.push(node);
      } else {
        const parent = nodeMap.get(agent.reports_to);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      }
    }

    res.json(roots);
    return;
  }

  const agents = db.prepare(`
    SELECT a.*, p.name AS provider_name
    FROM agents a
    LEFT JOIN providers p ON a.provider_id = p.id
    ORDER BY a.created_at DESC
  `).all();

  res.json(agents);
});

// POST / - hire agent
router.post('/', (req, res) => {
  const { name, role, provider_id, model, system_prompt, reports_to, budget_limit } = req.body;

  if (!name || !role || !provider_id || !model) {
    res.status(400).json({ error: 'name, role, provider_id, and model are required' });
    return;
  }

  const provider = db.prepare(`SELECT id FROM providers WHERE id = ?`).get(provider_id);
  if (!provider) {
    res.status(400).json({ error: `Provider ${provider_id} not found` });
    return;
  }

  if (reports_to) {
    const manager = db.prepare(`SELECT id FROM agents WHERE id = ?`).get(reports_to);
    if (!manager) {
      res.status(400).json({ error: `Manager agent ${reports_to} not found` });
      return;
    }
  }

  const result = db.prepare(`
    INSERT INTO agents (name, role, provider_id, model, system_prompt, reports_to, budget_limit)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, role, provider_id, model, system_prompt || null, reports_to || null, budget_limit || 0);

  const agent = db.prepare(`
    SELECT a.*, p.name AS provider_name
    FROM agents a
    LEFT JOIN providers p ON a.provider_id = p.id
    WHERE a.id = ?
  `).get(result.lastInsertRowid);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('agent_hired', `Hired ${name} as ${role}`, JSON.stringify({ agentId: Number(result.lastInsertRowid) }));

  try { getIO().emit('agent:created', agent); } catch { /* socket not ready */ }

  res.status(201).json(agent);
});

// PATCH /:id - update agent
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { name, role, provider_id, model, system_prompt, reports_to, budget_limit, status } = req.body;

  const existing = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(id);
  if (!existing) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (role !== undefined) { fields.push('role = ?'); values.push(role); }
  if (provider_id !== undefined) { fields.push('provider_id = ?'); values.push(provider_id); }
  if (model !== undefined) { fields.push('model = ?'); values.push(model); }
  if (system_prompt !== undefined) { fields.push('system_prompt = ?'); values.push(system_prompt); }
  if (reports_to !== undefined) { fields.push('reports_to = ?'); values.push(reports_to); }
  if (budget_limit !== undefined) { fields.push('budget_limit = ?'); values.push(budget_limit); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE agents SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const agent = db.prepare(`
    SELECT a.*, p.name AS provider_name
    FROM agents a
    LEFT JOIN providers p ON a.provider_id = p.id
    WHERE a.id = ?
  `).get(id);

  try { getIO().emit('agent:updated', agent); } catch { /* socket not ready */ }

  res.json(agent);
});

// DELETE /:id - soft delete (terminate)
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(id) as AgentRow | undefined;
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  db.prepare(`UPDATE agents SET status = 'terminated' WHERE id = ?`).run(id);

  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run('agent_terminated', `Agent "${agent.name}" (${agent.role}) terminated`, JSON.stringify({ agentId: Number(id) }));

  try { getIO().emit('agent:updated', { id: Number(id), status: 'terminated' }); } catch { /* socket not ready */ }

  res.json({ success: true, message: `Agent "${agent.name}" terminated` });
});

export default router;
