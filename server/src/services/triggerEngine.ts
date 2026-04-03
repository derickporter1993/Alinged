import db from '../db.js';
import { getIO } from '../socket.js';

/**
 * Fires all enabled triggers matching the given event.
 * Checks conditions against the provided context and executes the configured action.
 */
export function fireTriggers(event: string, context: Record<string, unknown>): void {
  const triggers = db.prepare(`
    SELECT * FROM workflow_triggers WHERE trigger_event = ? AND enabled = 1
  `).all(event) as Array<{
    id: number;
    name: string;
    trigger_event: string;
    condition_config: string | null;
    action_config: string;
  }>;

  for (const trigger of triggers) {
    // Check conditions if present
    if (trigger.condition_config) {
      const conditions = JSON.parse(trigger.condition_config) as Record<string, unknown>;
      let match = true;

      for (const [key, value] of Object.entries(conditions)) {
        if (context[key] !== value) {
          match = false;
          break;
        }
      }

      if (!match) continue;
    }

    // Execute the action
    const action = JSON.parse(trigger.action_config) as Record<string, unknown>;

    try {
      switch (action.type) {
        case 'create_ticket': {
          const ticketResult = db.prepare(`
            INSERT INTO tickets (goal_id, agent_id, title, description, priority, status)
            VALUES (?, ?, ?, ?, ?, 'todo')
          `).run(
            (action.goal_id as number) || null,
            (action.agent_id as number) || null,
            (action.title as string) || `Auto-created by trigger: ${trigger.name}`,
            (action.description as string) || null,
            (action.priority as number) || 0
          );

          const ticket = db.prepare(`
            SELECT t.*, a.name AS agent_name, g.title AS goal_title
            FROM tickets t
            LEFT JOIN agents a ON t.agent_id = a.id
            LEFT JOIN goals g ON t.goal_id = g.id
            WHERE t.id = ?
          `).get(ticketResult.lastInsertRowid);

          try { getIO().emit('ticket:created', ticket); } catch { /* socket not ready */ }
          break;
        }

        case 'notify': {
          const message = (action.message as string) || `Trigger "${trigger.name}" fired for event "${event}"`;
          db.prepare(`INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)`)
            .run('trigger_fired', message, JSON.stringify({ triggerId: trigger.id, event, context }));

          try { getIO().emit('activity:new', { type: 'trigger_fired', message }); } catch { /* socket not ready */ }
          break;
        }

        case 'assign_agent': {
          const ticketId = context.ticket_id || action.ticket_id;
          const agentId = action.agent_id;

          if (ticketId && agentId) {
            db.prepare(`UPDATE tickets SET agent_id = ?, updated_at = datetime('now') WHERE id = ?`)
              .run(agentId, ticketId);

            const updatedTicket = db.prepare(`
              SELECT t.*, a.name AS agent_name, g.title AS goal_title
              FROM tickets t
              LEFT JOIN agents a ON t.agent_id = a.id
              LEFT JOIN goals g ON t.goal_id = g.id
              WHERE t.id = ?
            `).get(ticketId);

            try { getIO().emit('ticket:updated', updatedTicket); } catch { /* socket not ready */ }
          }
          break;
        }
      }
    } catch (err) {
      console.error(`[TriggerEngine] Error executing trigger "${trigger.name}":`, err);
    }
  }
}
