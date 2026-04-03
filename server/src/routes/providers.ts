import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET / - list providers (mask API keys)
router.get('/', (_req, res) => {
  const providers = db.prepare('SELECT * FROM providers ORDER BY created_at DESC').all() as Record<string, unknown>[];

  const masked = providers.map((p) => ({
    ...p,
    api_key: p.api_key ? '****' + String(p.api_key).slice(-4) : '',
  }));

  res.json(masked);
});

// POST / - create provider
router.post('/', (req, res) => {
  const { name, api_key, base_url } = req.body;

  if (!name || !api_key) {
    res.status(400).json({ error: 'name and api_key are required' });
    return;
  }

  const existing = db.prepare('SELECT id FROM providers WHERE name = ?').get(name);
  if (existing) {
    res.status(409).json({ error: `Provider "${name}" already exists` });
    return;
  }

  const result = db.prepare(
    'INSERT INTO providers (name, api_key, base_url) VALUES (?, ?, ?)'
  ).run(name, api_key, base_url || null);

  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;

  res.status(201).json({
    ...provider,
    api_key: '****' + api_key.slice(-4),
  });
});

// PATCH /:id - update provider
router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { name, api_key, base_url } = req.body;

  const existing = db.prepare('SELECT id FROM providers WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Provider not found' });
    return;
  }

  const fields: string[] = [];
  const values: unknown[] = [];

  if (name !== undefined) { fields.push('name = ?'); values.push(name); }
  if (api_key !== undefined) { fields.push('api_key = ?'); values.push(api_key); }
  if (base_url !== undefined) { fields.push('base_url = ?'); values.push(base_url); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE providers SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(id) as Record<string, unknown>;

  res.json({
    ...provider,
    api_key: '****' + String(provider.api_key).slice(-4),
  });
});

// DELETE /:id
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT id FROM providers WHERE id = ?').get(id);
  if (!existing) {
    res.status(404).json({ error: 'Provider not found' });
    return;
  }

  // Check if any agents use this provider
  const agentsUsing = db.prepare('SELECT COUNT(*) as count FROM agents WHERE provider_id = ? AND status != ?').get(id, 'terminated') as { count: number };
  if (agentsUsing.count > 0) {
    res.status(400).json({ error: `Cannot delete: ${agentsUsing.count} agent(s) use this provider` });
    return;
  }

  db.prepare('DELETE FROM providers WHERE id = ?').run(id);
  res.json({ message: 'Provider deleted' });
});

export default router;
