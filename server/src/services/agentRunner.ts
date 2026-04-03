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
}

interface ProviderRow {
  id: number;
  name: string;
  api_key: string;
  base_url: string | null;
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
    return;
  }

  // 3. Set statuses
  db.prepare(`UPDATE agents SET status = 'busy' WHERE id = ?`).run(agent.id);
  db.prepare(`UPDATE tickets SET status = 'in_progress', updated_at = datetime('now') WHERE id = ?`).run(ticketId);
  io.emit('agent:updated', { id: agent.id, status: 'busy' });
  io.emit('ticket:updated', { id: ticketId, status: 'in_progress' });

  const systemPrompt = agent.system_prompt || `You are ${agent.name}, a ${agent.role}. Complete the assigned task thoroughly.`;
  const userMessage = `Task: ${ticket.title}\n\n${ticket.description || 'No additional details.'}`;

  try {
    let result = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const providerName = provider.name.toLowerCase();

    if (providerName.includes('anthropic') || providerName.includes('claude')) {
      // Anthropic
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
      // OpenAI
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

      // Estimate tokens if not provided by streaming
      if (inputTokens === 0) {
        inputTokens = Math.ceil((systemPrompt.length + userMessage.length) / 4);
      }
      if (outputTokens === 0) {
        outputTokens = Math.ceil(result.length / 4);
      }
    }

    // 7. Save result
    db.prepare(
      `UPDATE tickets SET status = 'review', result = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(result, ticketId);
    db.prepare(`UPDATE agents SET status = 'idle' WHERE id = ?`).run(agent.id);

    io.emit('ticket:updated', { id: ticketId, status: 'review', result });
    io.emit('agent:updated', { id: agent.id, status: 'idle' });

    // 8. Record usage
    recordUsage(agent.id, ticketId, provider.name, agent.model, inputTokens, outputTokens);

    db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
      .run('ticket_completed', `Agent "${agent.name}" completed ticket "${ticket.title}"`, JSON.stringify({ agentId: agent.id, ticketId }));

  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    db.prepare(
      `UPDATE tickets SET status = 'failed', result = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(`Error: ${errorMessage}`, ticketId);
    db.prepare(`UPDATE agents SET status = 'idle' WHERE id = ?`).run(agent.id);

    io.emit('ticket:updated', { id: ticketId, status: 'failed', result: `Error: ${errorMessage}` });
    io.emit('agent:updated', { id: agent.id, status: 'idle' });

    db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
      .run('ticket_failed', `Agent "${agent.name}" failed on ticket "${ticket.title}": ${errorMessage}`, JSON.stringify({ agentId: agent.id, ticketId, error: errorMessage }));
  }
}
