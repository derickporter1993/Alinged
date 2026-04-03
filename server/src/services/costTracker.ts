import db from '../db.js';
import { getIO } from '../socket.js';

// Pricing per million tokens
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-20250514': { input: 3, output: 15 },
  'claude-opus-4-20250514': { input: 15, output: 75 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'claude-haiku-3-5-20241022': { input: 0.8, output: 4 },
};

export function recordUsage(
  agentId: number,
  ticketId: number | null,
  provider: string,
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const pricing = PRICING[model] || { input: 1, output: 3 };
  const costUsd =
    (inputTokens / 1_000_000) * pricing.input +
    (outputTokens / 1_000_000) * pricing.output;

  db.prepare(
    `INSERT INTO cost_logs (agent_id, ticket_id, provider, model, input_tokens, output_tokens, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(agentId, ticketId, provider, model, inputTokens, outputTokens, costUsd);

  db.prepare(
    `UPDATE agents SET budget_spent = budget_spent + ? WHERE id = ?`
  ).run(costUsd, agentId);

  // Check if over 80% of budget and log warning
  const agent = db.prepare(
    `SELECT name, budget_limit, budget_spent FROM agents WHERE id = ?`
  ).get(agentId) as { name: string; budget_limit: number; budget_spent: number } | undefined;

  if (agent && agent.budget_limit > 0) {
    const usage = (agent.budget_spent + costUsd) / agent.budget_limit;
    if (usage >= 0.8) {
      const pct = Math.round(usage * 100);
      db.prepare(
        `INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`
      ).run(
        'budget_warning',
        `Agent "${agent.name}" has used ${pct}% of budget ($${(agent.budget_spent + costUsd).toFixed(4)} / $${agent.budget_limit.toFixed(2)})`,
        JSON.stringify({ agentId, percentage: pct })
      );

      try {
        getIO().emit('budget:warning', { agentId, name: agent.name, percentage: pct });
      } catch {
        // Socket may not be initialized in tests
      }
    }
  }

  return costUsd;
}

export function checkBudget(agentId: number): {
  allowed: boolean;
  remaining: number;
  spent: number;
  limit: number;
} {
  const agent = db.prepare(
    `SELECT budget_limit, budget_spent FROM agents WHERE id = ?`
  ).get(agentId) as { budget_limit: number; budget_spent: number } | undefined;

  if (!agent) {
    return { allowed: false, remaining: 0, spent: 0, limit: 0 };
  }

  // If budget_limit is 0, treat as unlimited
  if (agent.budget_limit === 0) {
    return {
      allowed: true,
      remaining: Infinity,
      spent: agent.budget_spent,
      limit: 0,
    };
  }

  const remaining = agent.budget_limit - agent.budget_spent;
  return {
    allowed: remaining > 0,
    remaining,
    spent: agent.budget_spent,
    limit: agent.budget_limit,
  };
}
