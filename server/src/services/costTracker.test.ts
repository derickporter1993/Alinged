import { describe, it, expect } from 'vitest';
import { recordUsage, checkBudget } from './costTracker.js';
import db from '../db.js';

function seedProvider() {
  const r = db.prepare('INSERT INTO providers (name, api_key) VALUES (?, ?)').run('Anthropic', 'key');
  return Number(r.lastInsertRowid);
}

function seedAgent(providerId: number, budgetLimit = 10, budgetSpent = 0) {
  const r = db.prepare(
    'INSERT INTO agents (name, role, provider_id, model, budget_limit, budget_spent) VALUES (?, ?, ?, ?, ?, ?)'
  ).run('Agent', 'Dev', providerId, 'gpt-4o', budgetLimit, budgetSpent);
  return Number(r.lastInsertRowid);
}

describe('costTracker', () => {
  describe('recordUsage', () => {
    it('calculates cost correctly for gpt-4o', () => {
      const pid = seedProvider();
      const aid = seedAgent(pid);

      // gpt-4o pricing: input $2.5/M, output $10/M
      const cost = recordUsage(aid, null, 'openai', 'gpt-4o', 1000, 500);

      // Expected: (1000/1M)*2.5 + (500/1M)*10 = 0.0025 + 0.005 = 0.0075
      expect(cost).toBeCloseTo(0.0075, 6);
    });

    it('updates agent budget_spent', () => {
      const pid = seedProvider();
      const aid = seedAgent(pid);

      recordUsage(aid, null, 'openai', 'gpt-4o', 1000, 500);

      const agent = db.prepare('SELECT budget_spent FROM agents WHERE id = ?').get(aid) as { budget_spent: number };
      expect(agent.budget_spent).toBeCloseTo(0.0075, 6);
    });

    it('creates a cost_logs entry', () => {
      const pid = seedProvider();
      const aid = seedAgent(pid);

      recordUsage(aid, null, 'openai', 'gpt-4o', 1000, 500);

      const log = db.prepare('SELECT * FROM cost_logs WHERE agent_id = ?').get(aid) as Record<string, unknown>;
      expect(log).toBeDefined();
      expect(log.input_tokens).toBe(1000);
      expect(log.output_tokens).toBe(500);
    });

    it('logs budget warning at 80% usage', () => {
      const pid = seedProvider();
      const aid = seedAgent(pid, 0.01, 0.008); // limit 0.01, already spent 0.008 (80%)

      recordUsage(aid, null, 'openai', 'gpt-4o', 1000, 500);

      const activity = db.prepare(
        "SELECT * FROM activity WHERE type = 'budget_warning' AND message LIKE ?"
      ).get('%Agent%') as Record<string, unknown> | undefined;
      expect(activity).toBeDefined();
    });

    it('uses fallback pricing for unknown models', () => {
      const pid = seedProvider();
      const aid = seedAgent(pid);

      // Unknown model defaults to input $1/M, output $3/M
      const cost = recordUsage(aid, null, 'unknown', 'some-model', 1_000_000, 1_000_000);
      expect(cost).toBeCloseTo(4.0, 2); // 1 + 3
    });
  });

  describe('checkBudget', () => {
    it('returns allowed true when under budget', () => {
      const pid = seedProvider();
      const aid = seedAgent(pid, 10, 5);

      const result = checkBudget(aid);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(5);
      expect(result.spent).toBe(5);
      expect(result.limit).toBe(10);
    });

    it('returns allowed false when budget exceeded', () => {
      const pid = seedProvider();
      const aid = seedAgent(pid, 10, 10);

      const result = checkBudget(aid);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('returns unlimited when budget_limit is 0', () => {
      const pid = seedProvider();
      const aid = seedAgent(pid, 0, 100);

      const result = checkBudget(aid);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(Infinity);
    });

    it('returns not allowed for non-existent agent', () => {
      const result = checkBudget(999);
      expect(result.allowed).toBe(false);
    });
  });
});
