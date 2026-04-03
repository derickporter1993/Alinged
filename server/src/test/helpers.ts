import type Database from 'better-sqlite3';

export function seedProvider(db: Database.Database, overrides: Record<string, unknown> = {}) {
  const result = db.prepare(`
    INSERT INTO providers (name, api_key, base_url) VALUES (?, ?, ?)
  `).run(
    overrides.name || 'Anthropic',
    overrides.api_key || 'test-key-123',
    overrides.base_url || null,
  );
  return Number(result.lastInsertRowid);
}

export function seedAgent(db: Database.Database, providerId: number, overrides: Record<string, unknown> = {}) {
  const result = db.prepare(`
    INSERT INTO agents (name, role, provider_id, model, system_prompt, budget_limit, budget_spent, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    overrides.name || 'Test Agent',
    overrides.role || 'Developer',
    providerId,
    overrides.model || 'gpt-4o',
    overrides.system_prompt || 'You are a test agent.',
    overrides.budget_limit ?? 10.0,
    overrides.budget_spent ?? 0,
    overrides.status || 'idle',
  );
  return Number(result.lastInsertRowid);
}

export function seedGoal(db: Database.Database, overrides: Record<string, unknown> = {}) {
  const result = db.prepare(`
    INSERT INTO goals (title, description, status) VALUES (?, ?, ?)
  `).run(
    overrides.title || 'Test Goal',
    overrides.description || 'A test goal',
    overrides.status || 'active',
  );
  return Number(result.lastInsertRowid);
}

export function seedTicket(db: Database.Database, overrides: Record<string, unknown> = {}) {
  const result = db.prepare(`
    INSERT INTO tickets (title, description, goal_id, agent_id, status, priority)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    overrides.title || 'Test Ticket',
    overrides.description || 'A test ticket',
    overrides.goal_id || null,
    overrides.agent_id || null,
    overrides.status || 'backlog',
    overrides.priority || 0,
  );
  return Number(result.lastInsertRowid);
}

export function seedUser(db: Database.Database, overrides: Record<string, unknown> = {}) {
  const result = db.prepare(`
    INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)
  `).run(
    overrides.email || 'test@example.com',
    overrides.password_hash || '$2a$10$test',
    overrides.name || 'Test User',
  );
  return Number(result.lastInsertRowid);
}
