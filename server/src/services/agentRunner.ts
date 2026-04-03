import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import db from '../db.js';
import { getIO } from '../socket.js';
import { recordUsage, checkBudget } from './costTracker.js';

interface TicketRow {
  id: number;
  title: string;
  description: string | null;
  goal_id: number | null;
  agent_id: number | null;
  status: string;
}

interface AgentRow {
  id: number;
  name: string;
  role: string;
  model: string;
  system_prompt: string | null;
  provider_id: number;
  status: string;
  requires_approval: number;
}

interface ProviderRow {
  id: number;
  name: string;
  api_key: string;
  base_url: string | null;
}

interface ValidationRuleRow {
  id: number;
  name: string;
  rule_type: string;
  rule_config: string;
}

function logConversation(agentId: number, ticketId: number | null, role: string, content: string, tokens: number) {
  db.prepare(
    `INSERT INTO conversation_logs (agent_id, ticket_id, role, content, tokens) VALUES (?, ?, ?, ?, ?)`
  ).run(agentId, ticketId, role, content, tokens);
}

function saveVersion(ticketId: number, result: string, agentId: number | null) {
  const lastVersion = db.prepare(
    `SELECT MAX(version_number) as max_v FROM ticket_versions WHERE ticket_id = ?`
  ).get(ticketId) as { max_v: number | null } | undefined;
  const nextVersion = (lastVersion?.max_v ?? 0) + 1;
  db.prepare(
    `INSERT INTO ticket_versions (ticket_id, version_number, result, agent_id) VALUES (?, ?, ?, ?)`
  ).run(ticketId, nextVersion, result, agentId);
}

function validateOutput(agentId: number, text: string): { valid: boolean; failures: string[] } {
  const rules = db.prepare(
    `SELECT * FROM validation_rules WHERE enabled = 1 AND (agent_id IS NULL OR agent_id = ?)`
  ).all(agentId) as ValidationRuleRow[];

  const failures: string[] = [];
  for (const rule of rules) {
    let config: Record<string, unknown>;
    try { config = JSON.parse(rule.rule_config); } catch { continue; }

    switch (rule.rule_type) {
      case 'regex': {
        const pattern = new RegExp(config.pattern as string);
        if (!pattern.test(text)) failures.push(`Rule "${rule.name}": regex pattern not matched`);
        break;
      }
      case 'min_length':
        if (text.length < (config.min as number)) failures.push(`Rule "${rule.name}": below min length ${config.min}`);
        break;
      case 'max_length':
        if (text.length > (config.max as number)) failures.push(`Rule "${rule.name}": exceeds max length ${config.max}`);
        break;
      case 'contains':
        if (!text.includes(config.value as string)) failures.push(`Rule "${rule.name}": must contain "${config.value}"`);
        break;
      case 'not_contains':
        if (text.includes(config.value as string)) failures.push(`Rule "${rule.name}": must not contain "${config.value}"`);
        break;
      case 'json_schema':
        try { JSON.parse(text); } catch { failures.push(`Rule "${rule.name}": invalid JSON`); }
        break;
    }
  }

  return { valid: failures.length === 0, failures };
}

function fireTriggersSafe(event: string, context: Record<string, unknown>) {
  try {
    const triggers = db.prepare(
      `SELECT * FROM workflow_triggers WHERE enabled = 1 AND trigger_event = ?`
    ).all(event) as { id: number; action_config: string; condition_config: string | null }[];

    const io = getIO();
    for (const trigger of triggers) {
      let action: Record<string, unknown>;
      try { action = JSON.parse(trigger.action_config); } catch { continue; }

      if (trigger.condition_config) {
        try {
          const cond = JSON.parse(trigger.condition_config);
          const match = Object.entries(cond).every(([k, v]) => context[k] === v);
          if (!match) continue;
        } catch { continue; }
      }

      if (action.type === 'create_ticket') {
        const result = db.prepare(
          `INSERT INTO tickets (title, description, agent_id, goal_id, priority) VALUES (?, ?, ?, ?, ?)`
        ).run(
          action.title || `Auto-created from trigger`,
          action.description || null,
          action.agent_id || null,
          action.goal_id || context.goal_id || null,
          action.priority || 0
        );
        io.emit('ticket:updated', { id: Number(result.lastInsertRowid) });
      } else if (action.type === 'notify') {
        db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
          .run('trigger_notify', action.message || `Trigger fired for ${event}`, JSON.stringify(context));
        io.emit('activity:new', { type: 'trigger_notify', message: action.message });
      } else if (action.type === 'assign_agent' && context.ticket_id) {
        db.prepare(`UPDATE tickets SET agent_id = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(action.agent_id, context.ticket_id);
        io.emit('ticket:updated', { id: context.ticket_id, agent_id: action.agent_id });
      }
    }
  } catch {
    // Trigger engine errors should not break the main flow
  }
}

function fireWebhooksSafe(event: string, payload: Record<string, unknown>) {
  try {
    const webhooks = db.prepare(
      `SELECT * FROM webhooks WHERE enabled = 1`
    ).all() as { id: number; url: string; events: string; secret: string | null }[];

    for (const wh of webhooks) {
      if (!wh.events.split(',').map(e => e.trim()).includes(event)) continue;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (wh.secret) headers['X-Webhook-Secret'] = wh.secret;
      fetch(wh.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ event, payload, timestamp: new Date().toISOString() }),
      }).catch(() => { /* fire and forget */ });
    }
  } catch {
    // Webhook errors should not break the main flow
  }
}

export async function runTicket(ticketId: number): Promise<void> {
  const io = getIO();

  // 1. Load ticket, agent, provider
  const ticket = db.prepare(`SELECT * FROM tickets WHERE id = ?`).get(ticketId) as TicketRow | undefined;
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);
  if (!ticket.agent_id) throw new Error(`Ticket ${ticketId} has no assigned agent`);

  const agent = db.prepare(`SELECT * FROM agents WHERE id = ?`).get(ticket.agent_id) as AgentRow | undefined;
  if (!agent) throw new Error(`Agent ${ticket.agent_id} not found`);
  if (agent.status === 'terminated') throw new Error(`Agent "${agent.name}" is terminated`);

  const provider = db.prepare(`SELECT * FROM providers WHERE id = ?`).get(agent.provider_id) as ProviderRow | undefined;
  if (!provider) throw new Error(`Provider ${agent.provider_id} not found`);

  // 2. Check budget
  const budget = checkBudget(agent.id);
  if (!budget.allowed) {
    db.prepare(`UPDATE tickets SET status = 'failed', result = ?, updated_at = datetime('now') WHERE id = ?`)
      .run('Budget exceeded', ticketId);
    db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
      .run('budget_exceeded', `Agent "${agent.name}" cannot run ticket "${ticket.title}" - budget exceeded`, JSON.stringify({ agentId: agent.id, ticketId }));
    io.emit('ticket:updated', { id: ticketId, status: 'failed', result: 'Budget exceeded' });
    fireTriggersSafe('budget_alert', { agent_id: agent.id, ticket_id: ticketId });
    return;
  }

  // 3. Set statuses
  db.prepare(`UPDATE agents SET status = 'busy' WHERE id = ?`).run(agent.id);
  db.prepare(`UPDATE tickets SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(ticketId);
  io.emit('agent:updated', { id: agent.id, status: 'busy' });
  io.emit('ticket:updated', { id: ticketId, status: 'in_progress' });

  const systemPrompt = agent.system_prompt || `You are ${agent.name}, a ${agent.role}. Complete the assigned task thoroughly.`;
  const userMessage = `Task: ${ticket.title}\n\n${ticket.description || 'No additional details.'}`;

  // Log conversation inputs
  logConversation(agent.id, ticketId, 'system', systemPrompt, 0);
  logConversation(agent.id, ticketId, 'user', userMessage, 0);

  try {
    let result = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const providerName = provider.name.toLowerCase();

    if (providerName.includes('anthropic') || providerName.includes('claude')) {
      const client = new Anthropic({ apiKey: provider.api_key, ...(provider.base_url ? { baseURL: provider.base_url } : {}) });

      const stream = client.messages.stream({
        model: agent.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      stream.on('text', (text) => {
        result += text;
        io.emit(`ticket:progress:${ticketId}`, { ticketId, chunk: text });
      });

      const finalMessage = await stream.finalMessage();
      inputTokens = finalMessage.usage.input_tokens;
      outputTokens = finalMessage.usage.output_tokens;

    } else {
      const client = new OpenAI({ apiKey: provider.api_key, ...(provider.base_url ? { baseURL: provider.base_url } : {}) });

      const stream = await client.chat.completions.create({
        model: agent.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        max_tokens: 4096,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          result += content;
          io.emit(`ticket:progress:${ticketId}`, { ticketId, chunk: content });
        }
        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens || 0;
          outputTokens = chunk.usage.completion_tokens || 0;
        }
      }

      if (inputTokens === 0) inputTokens = Math.ceil((systemPrompt.length + userMessage.length) / 4);
      if (outputTokens === 0) outputTokens = Math.ceil(result.length / 4);
    }

    // Log assistant response
    logConversation(agent.id, ticketId, 'assistant', result, outputTokens);

    // Validate output
    const validation = validateOutput(agent.id, result);
    if (!validation.valid) {
      db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
        .run('validation_failed', `Output from "${agent.name}" failed validation: ${validation.failures.join('; ')}`,
          JSON.stringify({ agentId: agent.id, ticketId, failures: validation.failures }));
    }

    // Save version
    saveVersion(ticketId, result, agent.id);

    // Check if agent requires human approval
    const needsApproval = agent.requires_approval === 1;

    if (needsApproval) {
      // Create checkpoint for human review
      db.prepare(
        `INSERT INTO checkpoints (ticket_id, agent_id, output_preview, status) VALUES (?, ?, ?, 'pending')`
      ).run(ticketId, agent.id, result.substring(0, 500));

      db.prepare(
        `UPDATE tickets SET status = 'review', result = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(result, ticketId);

      io.emit('checkpoint:new', { ticketId, agentId: agent.id });
      io.emit('ticket:updated', { id: ticketId, status: 'review', result });

      db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
        .run('checkpoint_created', `Checkpoint created for "${ticket.title}" - awaiting approval`,
          JSON.stringify({ agentId: agent.id, ticketId }));
    } else {
      // Save result directly
      db.prepare(
        `UPDATE tickets SET status = 'review', result = ?, updated_at = datetime('now') WHERE id = ?`
      ).run(result, ticketId);

      io.emit('ticket:updated', { id: ticketId, status: 'review', result });

      db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
        .run('ticket_completed', `Agent "${agent.name}" completed ticket "${ticket.title}"`,
          JSON.stringify({ agentId: agent.id, ticketId }));

      // Fire triggers
      fireTriggersSafe('ticket_review', { agent_id: agent.id, ticket_id: ticketId, goal_id: ticket.goal_id });
    }

    db.prepare(`UPDATE agents SET status = 'idle' WHERE id = ?`).run(agent.id);
    io.emit('agent:updated', { id: agent.id, status: 'idle' });

    // Record usage
    recordUsage(agent.id, ticketId, provider.name, agent.model, inputTokens, outputTokens);

    // Fire webhooks
    fireWebhooksSafe('ticket_completed', { ticket_id: ticketId, agent_id: agent.id, agent_name: agent.name, title: ticket.title });

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    db.prepare(
      `UPDATE tickets SET status = 'failed', result = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(`Error: ${errorMessage}`, ticketId);
    db.prepare(`UPDATE agents SET status = 'idle' WHERE id = ?`).run(agent.id);

    io.emit('ticket:updated', { id: ticketId, status: 'failed', result: `Error: ${errorMessage}` });
    io.emit('agent:updated', { id: agent.id, status: 'idle' });

    db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
      .run('ticket_failed', `Agent "${agent.name}" failed on ticket "${ticket.title}": ${errorMessage}`,
        JSON.stringify({ agentId: agent.id, ticketId, error: errorMessage }));

    // Fire triggers and webhooks for failure
    fireTriggersSafe('ticket_failed', { agent_id: agent.id, ticket_id: ticketId, goal_id: ticket.goal_id, error: errorMessage });
    fireWebhooksSafe('ticket_failed', { ticket_id: ticketId, agent_id: agent.id, error: errorMessage });
  }
}
