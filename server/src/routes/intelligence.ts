import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import db from '../db.js';
import { getIO } from '../socket.js';
import { recordUsage, checkBudget } from '../services/costTracker.js';

const router = Router();

// ─── Interfaces ───────────────────────────────────────────────

interface AgentRow {
  id: number;
  name: string;
  role: string;
  model: string;
  system_prompt: string | null;
  provider_id: number;
  status: string;
  budget_limit: number;
  budget_spent: number;
}

interface ProviderRow {
  id: number;
  name: string;
  api_key: string;
  base_url: string | null;
}

interface TicketRow {
  id: number;
  title: string;
  description: string | null;
  goal_id: number | null;
  agent_id: number | null;
  status: string;
  result: string | null;
}

interface ScoreRow {
  id: number;
  name: string;
  role: string;
  total_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
  total_cost: number;
}

// ─── Helper: compute scores for agents ────────────────────────

function computeScores(agentId?: number) {
  const whereClause = agentId
    ? `WHERE a.id = ? AND a.status != 'terminated'`
    : `WHERE a.status != 'terminated'`;
  const params = agentId ? [agentId] : [];

  const rows = db.prepare(`
    SELECT
      a.id,
      a.name,
      a.role,
      COALESCE((SELECT COUNT(*) FROM tickets t WHERE t.agent_id = a.id), 0) AS total_tasks,
      COALESCE((SELECT COUNT(*) FROM tickets t WHERE t.agent_id = a.id AND t.status = 'done'), 0) AS successful_tasks,
      COALESCE((SELECT COUNT(*) FROM tickets t WHERE t.agent_id = a.id AND t.status = 'failed'), 0) AS failed_tasks,
      COALESCE((SELECT SUM(cl.cost_usd) FROM cost_logs cl WHERE cl.agent_id = a.id), 0) AS total_cost
    FROM agents a
    ${whereClause}
    ORDER BY a.id
  `).all(...params) as ScoreRow[];

  return rows.map((r) => {
    const success_rate = r.total_tasks > 0 ? r.successful_tasks / r.total_tasks : 0;
    const avg_cost_per_task = r.total_tasks > 0 ? r.total_cost / r.total_tasks : 0;
    return {
      agent_id: r.id,
      agent_name: r.name,
      role: r.role,
      total_tasks: r.total_tasks,
      successful_tasks: r.successful_tasks,
      failed_tasks: r.failed_tasks,
      success_rate: Math.round(success_rate * 10000) / 10000,
      total_cost: Math.round(r.total_cost * 10000) / 10000,
      avg_cost_per_task: Math.round(avg_cost_per_task * 10000) / 10000,
    };
  }).sort((a, b) => b.success_rate - a.success_rate);
}

// ─── GET /scores ──────────────────────────────────────────────

router.get('/scores', (_req, res) => {
  const scores = computeScores();
  res.json(scores);
});

// ─── GET /scores/:agentId ─────────────────────────────────────

router.get('/scores/:agentId', (req, res) => {
  const agentId = Number(req.params.agentId);
  const scores = computeScores(agentId);
  if (scores.length === 0) {
    res.status(404).json({ error: 'Agent not found or terminated' });
    return;
  }
  res.json(scores[0]);
});

// ─── POST /assign ─────────────────────────────────────────────

router.post('/assign', (req, res) => {
  const { ticket_id, preferred_role } = req.body;

  if (!ticket_id) {
    res.status(400).json({ error: 'ticket_id is required' });
    return;
  }

  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticket_id) as TicketRow | undefined;
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }

  // Get idle, non-terminated agents, optionally filtered by role
  let candidateQuery = `SELECT * FROM agents WHERE status = 'idle' AND status != 'terminated'`;
  const params: unknown[] = [];
  if (preferred_role) {
    candidateQuery += ` AND role = ?`;
    params.push(preferred_role);
  }
  const candidates = db.prepare(candidateQuery).all(...params) as AgentRow[];

  if (candidates.length === 0) {
    res.status(409).json({ error: 'No idle agents available' });
    return;
  }

  // Compute scores for candidates
  const candidateScores = candidates.map((agent) => {
    const totalTasks = (db.prepare(`SELECT COUNT(*) AS c FROM tickets WHERE agent_id = ?`).get(agent.id) as { c: number }).c;
    const successfulTasks = (db.prepare(`SELECT COUNT(*) AS c FROM tickets WHERE agent_id = ? AND status = 'done'`).get(agent.id) as { c: number }).c;
    const totalCost = (db.prepare(`SELECT COALESCE(SUM(cost_usd), 0) AS c FROM cost_logs WHERE agent_id = ?`).get(agent.id) as { c: number }).c;
    const inProgressCount = (db.prepare(`SELECT COUNT(*) AS c FROM tickets WHERE agent_id = ? AND status = 'in_progress'`).get(agent.id) as { c: number }).c;

    const success_rate = totalTasks > 0 ? successfulTasks / totalTasks : 0;
    const avg_cost = totalTasks > 0 ? totalCost / totalTasks : 0;
    const busyness = Math.min(inProgressCount / 5, 1);

    return { agent, success_rate, avg_cost, busyness };
  });

  // Find max avg cost for normalization
  const maxAvgCost = Math.max(...candidateScores.map((c) => c.avg_cost), 0);

  // Compute final weighted score
  const scored = candidateScores.map((c) => {
    const normalized_cost = maxAvgCost > 0 ? c.avg_cost / maxAvgCost : 0;
    const score = c.success_rate * 0.6 + (1 - normalized_cost) * 0.2 + (1 - c.busyness) * 0.2;
    return { ...c, score };
  }).sort((a, b) => b.score - a.score);

  const best = scored[0];
  const agent = best.agent;

  // Assign ticket
  db.prepare(`UPDATE tickets SET agent_id = ?, status = 'todo', updated_at = datetime('now') WHERE id = ?`)
    .run(agent.id, ticket_id);

  // Log activity
  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run(
      'smart_assignment',
      `Smart-assigned ticket "${ticket.title}" to agent "${agent.name}" (score: ${best.score.toFixed(3)})`,
      JSON.stringify({ ticket_id, agent_id: agent.id, score: best.score })
    );

  // Emit socket events
  try {
    const io = getIO();
    io.emit('ticket:updated', { id: ticket_id, agent_id: agent.id, status: 'todo' });
  } catch { /* socket not ready */ }

  res.json({
    ticket_id,
    agent_id: agent.id,
    agent_name: agent.name,
    score: Math.round(best.score * 10000) / 10000,
  });
});

// ─── POST /multi-step ─────────────────────────────────────────

router.post('/multi-step', async (req, res) => {
  const { ticket_id, max_steps = 5 } = req.body;

  if (!ticket_id) {
    res.status(400).json({ error: 'ticket_id is required' });
    return;
  }

  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticket_id) as TicketRow | undefined;
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  if (!ticket.agent_id) {
    res.status(400).json({ error: 'Ticket has no assigned agent' });
    return;
  }

  const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(ticket.agent_id) as AgentRow | undefined;
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }
  if (agent.status === 'terminated') {
    res.status(400).json({ error: 'Agent is terminated' });
    return;
  }

  const provider = db.prepare(`SELECT * FROM providers WHERE id = ?`).get(agent.provider_id) as ProviderRow | undefined;
  if (!provider) {
    res.status(404).json({ error: 'Provider not found' });
    return;
  }

  // Check budget
  const budget = checkBudget(agent.id);
  if (!budget.allowed) {
    res.status(400).json({ error: 'Agent budget exceeded' });
    return;
  }

  // Set statuses
  db.prepare(`UPDATE agents SET status = 'busy' WHERE id = ?`).run(agent.id);
  db.prepare(`UPDATE tickets SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(ticket_id);

  try {
    const io = getIO();
    io.emit('agent:updated', { id: agent.id, status: 'busy' });
    io.emit('ticket:updated', { id: ticket_id, status: 'in_progress' });
  } catch { /* socket not ready */ }

  const multiStepSystemAddition = `\nBreak this task into steps. For each step, output your reasoning and result. Output STEP_COMPLETE when a step is done, and TASK_COMPLETE when the entire task is finished.`;
  const baseSystemPrompt = (agent.system_prompt || `You are ${agent.name}, a ${agent.role}. Complete the assigned task thoroughly.`) + multiStepSystemAddition;
  const taskMessage = `Task: ${ticket.title}\n\n${ticket.description || 'No additional details.'}`;

  const providerName = provider.name.toLowerCase();
  const isAnthropic = providerName.includes('anthropic') || providerName.includes('claude');

  const allStepOutputs: string[] = [];
  let stepCount = 0;

  // Build conversation messages for multi-step
  const conversationMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  conversationMessages.push({ role: 'user', content: taskMessage });

  try {
    for (let step = 0; step < max_steps; step++) {
      stepCount = step + 1;

      // Check budget before each step
      const stepBudget = checkBudget(agent.id);
      if (!stepBudget.allowed) {
        allStepOutputs.push(`[Step ${stepCount} skipped: budget exceeded]`);
        break;
      }

      let stepResult = '';
      let inputTokens = 0;
      let outputTokens = 0;

      if (isAnthropic) {
        const client = new Anthropic({
          apiKey: provider.api_key,
          ...(provider.base_url ? { baseURL: provider.base_url } : {}),
        });

        const response = await client.messages.create({
          model: agent.model,
          max_tokens: 4096,
          system: baseSystemPrompt,
          messages: conversationMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        });

        stepResult = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === 'text')
          .map((block) => block.text)
          .join('');
        inputTokens = response.usage.input_tokens;
        outputTokens = response.usage.output_tokens;
      } else {
        const client = new OpenAI({
          apiKey: provider.api_key,
          ...(provider.base_url ? { baseURL: provider.base_url } : {}),
        });

        const response = await client.chat.completions.create({
          model: agent.model,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: baseSystemPrompt },
            ...conversationMessages.map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
          ],
        });

        stepResult = response.choices[0]?.message?.content || '';
        inputTokens = response.usage?.prompt_tokens || Math.ceil(baseSystemPrompt.length / 4);
        outputTokens = response.usage?.completion_tokens || Math.ceil(stepResult.length / 4);
      }

      allStepOutputs.push(stepResult);

      // Store step as a ticket version
      db.prepare(`
        INSERT INTO ticket_versions (ticket_id, version_number, result, agent_id)
        VALUES (?, ?, ?, ?)
      `).run(ticket_id, stepCount, stepResult, agent.id);

      // Record cost for this step
      recordUsage(agent.id, ticket_id, provider.name, agent.model, inputTokens, outputTokens);

      // Log conversation
      db.prepare(`
        INSERT INTO conversation_logs (agent_id, ticket_id, role, content, tokens)
        VALUES (?, ?, 'assistant', ?, ?)
      `).run(agent.id, ticket_id, stepResult, outputTokens);

      // Emit step progress
      try {
        getIO().emit(`ticket:progress:${ticket_id}`, {
          ticketId: ticket_id,
          step: stepCount,
          chunk: stepResult,
        });
      } catch { /* socket not ready */ }

      // Check for TASK_COMPLETE
      if (stepResult.includes('TASK_COMPLETE')) {
        break;
      }

      // Add assistant response and follow-up prompt to conversation
      conversationMessages.push({ role: 'assistant', content: stepResult });
      conversationMessages.push({
        role: 'user',
        content: 'Continue to the next step. If the task is complete, include TASK_COMPLETE in your response.',
      });
    }

    // Concatenate all steps into final result
    const finalResult = allStepOutputs.join('\n\n---\n\n');

    // Update ticket with final result
    db.prepare(`UPDATE tickets SET status = 'review', result = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(finalResult, ticket_id);
    db.prepare(`UPDATE agents SET status = 'idle' WHERE id = ?`).run(agent.id);

    // Log activity
    db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
      .run(
        'multi_step_completed',
        `Agent "${agent.name}" completed multi-step ticket "${ticket.title}" in ${stepCount} steps`,
        JSON.stringify({ ticket_id, agent_id: agent.id, steps: stepCount })
      );

    try {
      const io = getIO();
      io.emit('ticket:updated', { id: ticket_id, status: 'review', result: finalResult });
      io.emit('agent:updated', { id: agent.id, status: 'idle' });
    } catch { /* socket not ready */ }

    res.json({ ticket_id, steps: stepCount, result: finalResult });
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    db.prepare(`UPDATE tickets SET status = 'failed', result = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(`Error: ${errorMessage}`, ticket_id);
    db.prepare(`UPDATE agents SET status = 'idle' WHERE id = ?`).run(agent.id);

    try {
      const io = getIO();
      io.emit('ticket:updated', { id: ticket_id, status: 'failed', result: `Error: ${errorMessage}` });
      io.emit('agent:updated', { id: agent.id, status: 'idle' });
    } catch { /* socket not ready */ }

    db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
      .run(
        'multi_step_failed',
        `Agent "${agent.name}" failed multi-step on ticket "${ticket.title}": ${errorMessage}`,
        JSON.stringify({ ticket_id, agent_id: agent.id, error: errorMessage })
      );

    res.status(500).json({ error: errorMessage });
  }
});

export default router;
