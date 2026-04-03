import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import db from '../db.js';
import { recordUsage } from './costTracker.js';

interface GoalRow {
  id: number;
  title: string;
  description: string | null;
}

interface AgentRow {
  id: number;
  name: string;
  role: string;
  model: string;
  system_prompt: string | null;
  provider_id: number;
}

interface ProviderRow {
  id: number;
  name: string;
  api_key: string;
  base_url: string | null;
}

interface DecomposedTask {
  title: string;
  description: string;
  priority: number;
  suggested_role: string;
}

interface CreatedTicket {
  id: number;
  title: string;
  description: string;
  priority: number;
  agent_id: number | null;
  agent_name: string | null;
}

export async function decomposeGoal(goalId: number): Promise<CreatedTicket[]> {
  // 1. Load goal
  const goal = db.prepare(`SELECT * FROM goals WHERE id = ?`).get(goalId) as GoalRow | undefined;
  if (!goal) throw new Error(`Goal ${goalId} not found`);

  // 2. Find a planner agent
  const planner = db.prepare(
    `SELECT * FROM agents WHERE status != 'terminated' AND (LOWER(role) LIKE '%planner%' OR LOWER(role) LIKE '%ceo%') ORDER BY id LIMIT 1`
  ).get() as AgentRow | undefined;

  const agent = planner || db.prepare(
    `SELECT * FROM agents WHERE status != 'terminated' ORDER BY id LIMIT 1`
  ).get() as AgentRow | undefined;

  if (!agent) {
    throw new Error('No agents available for planning. Please hire at least one agent (ideally with a "planner" or "ceo" role) before decomposing goals.');
  }

  const provider = db.prepare(`SELECT * FROM providers WHERE id = ?`).get(agent.provider_id) as ProviderRow | undefined;
  if (!provider) throw new Error(`Provider ${agent.provider_id} not found for agent "${agent.name}"`);

  // 3. Call LLM
  const systemPrompt = 'You are a project planner. Break this business goal into 3-7 concrete, actionable tasks. Return ONLY a JSON array: [{"title": "...", "description": "...", "priority": 0-3, "suggested_role": "..."}]';
  const userMessage = `Goal: ${goal.title}\n\nDescription: ${goal.description || 'No additional details.'}`;

  let responseText = '';
  let inputTokens = 0;
  let outputTokens = 0;

  const providerName = provider.name.toLowerCase();

  if (providerName.includes('anthropic') || providerName.includes('claude')) {
    const client = new Anthropic({ apiKey: provider.api_key, ...(provider.base_url ? { baseURL: provider.base_url } : {}) });

    const message = await client.messages.create({
      model: agent.model,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    for (const block of message.content) {
      if (block.type === 'text') {
        responseText += block.text;
      }
    }
    inputTokens = message.usage.input_tokens;
    outputTokens = message.usage.output_tokens;

  } else {
    const client = new OpenAI({ apiKey: provider.api_key, ...(provider.base_url ? { baseURL: provider.base_url } : {}) });

    const completion = await client.chat.completions.create({
      model: agent.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      max_tokens: 2048,
    });

    responseText = completion.choices[0]?.message?.content || '';
    inputTokens = completion.usage?.prompt_tokens || Math.ceil((systemPrompt.length + userMessage.length) / 4);
    outputTokens = completion.usage?.completion_tokens || Math.ceil(responseText.length / 4);
  }

  // 4. Parse JSON response
  let tasks: DecomposedTask[];
  try {
    // Extract JSON array from response (handle markdown code blocks)
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array found in response');
    tasks = JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    throw new Error(`Failed to parse planner response: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}\n\nRaw response:\n${responseText}`);
  }

  // 5. Create tickets and auto-assign
  const insertTicket = db.prepare(
    `INSERT INTO tickets (goal_id, agent_id, title, description, priority, status)
     VALUES (?, ?, ?, ?, ?, 'todo')`
  );

  const createdTickets: CreatedTicket[] = [];

  for (const task of tasks) {
    // Try to find an agent matching the suggested role
    let assignedAgent: { id: number; name: string } | undefined;
    if (task.suggested_role) {
      assignedAgent = db.prepare(
        `SELECT id, name FROM agents WHERE status != 'terminated' AND LOWER(role) LIKE ? ORDER BY budget_spent ASC LIMIT 1`
      ).get(`%${task.suggested_role.toLowerCase()}%`) as { id: number; name: string } | undefined;
    }

    const result = insertTicket.run(
      goalId,
      assignedAgent?.id || null,
      task.title,
      task.description,
      task.priority || 0
    );

    createdTickets.push({
      id: Number(result.lastInsertRowid),
      title: task.title,
      description: task.description,
      priority: task.priority || 0,
      agent_id: assignedAgent?.id || null,
      agent_name: assignedAgent?.name || null,
    });
  }

  // 6. Record cost
  recordUsage(agent.id, null, provider.name, agent.model, inputTokens, outputTokens);

  // Log activity
  db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
    .run(
      'goal_decomposed',
      `Goal "${goal.title}" decomposed into ${createdTickets.length} tickets by agent "${agent.name}"`,
      JSON.stringify({ goalId, agentId: agent.id, ticketCount: createdTickets.length })
    );

  return createdTickets;
}
