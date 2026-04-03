import { describe, it, expect } from 'vitest';
import { fireTriggers } from './triggerEngine.js';
import db from '../db.js';

function seedProvider() {
  const r = db.prepare('INSERT INTO providers (name, api_key) VALUES (?, ?)').run('Anthropic', 'key');
  return Number(r.lastInsertRowid);
}

function seedAgent(providerId: number) {
  const r = db.prepare(
    'INSERT INTO agents (name, role, provider_id, model) VALUES (?, ?, ?, ?)'
  ).run('Agent', 'Dev', providerId, 'gpt-4o');
  return Number(r.lastInsertRowid);
}

function seedTicket(agentId?: number) {
  const r = db.prepare(
    'INSERT INTO tickets (title, description, agent_id, status) VALUES (?, ?, ?, ?)'
  ).run('Test Ticket', 'desc', agentId || null, 'backlog');
  return Number(r.lastInsertRowid);
}

function createTrigger(event: string, action: Record<string, unknown>, condition?: Record<string, unknown>) {
  db.prepare(
    'INSERT INTO workflow_triggers (name, trigger_event, condition_config, action_config, enabled) VALUES (?, ?, ?, ?, 1)'
  ).run(
    'Test Trigger',
    event,
    condition ? JSON.stringify(condition) : null,
    JSON.stringify(action)
  );
}

describe('triggerEngine', () => {
  describe('fireTriggers', () => {
    it('creates a ticket with create_ticket action', () => {
      createTrigger('ticket_done', { type: 'create_ticket', title: 'Follow-up', priority: 1 });

      fireTriggers('ticket_done', {});

      const tickets = db.prepare('SELECT * FROM tickets').all() as Record<string, unknown>[];
      expect(tickets).toHaveLength(1);
      expect(tickets[0].title).toBe('Follow-up');
      expect(tickets[0].priority).toBe(1);
    });

    it('creates a notify activity', () => {
      createTrigger('ticket_failed', { type: 'notify', message: 'Something broke!' });

      fireTriggers('ticket_failed', {});

      const activities = db.prepare("SELECT * FROM activity WHERE type = 'trigger_fired'").all() as Record<string, unknown>[];
      expect(activities).toHaveLength(1);
      expect(activities[0].message).toBe('Something broke!');
    });

    it('assigns an agent with assign_agent action', () => {
      const pid = seedProvider();
      const aid = seedAgent(pid);
      const tid = seedTicket();

      createTrigger('ticket_review', { type: 'assign_agent', agent_id: aid });

      fireTriggers('ticket_review', { ticket_id: tid });

      const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(tid) as Record<string, unknown>;
      expect(ticket.agent_id).toBe(aid);
    });

    it('skips triggers that do not match conditions', () => {
      createTrigger('ticket_done', { type: 'notify', message: 'Fired!' }, { agent_id: 999 });

      fireTriggers('ticket_done', { agent_id: 1 });

      const activities = db.prepare("SELECT * FROM activity WHERE type = 'trigger_fired'").all();
      expect(activities).toHaveLength(0);
    });

    it('fires trigger when conditions match', () => {
      createTrigger('ticket_done', { type: 'notify', message: 'Match!' }, { agent_id: 42 });

      fireTriggers('ticket_done', { agent_id: 42 });

      const activities = db.prepare("SELECT * FROM activity WHERE type = 'trigger_fired'").all();
      expect(activities).toHaveLength(1);
    });

    it('skips disabled triggers', () => {
      db.prepare(
        'INSERT INTO workflow_triggers (name, trigger_event, action_config, enabled) VALUES (?, ?, ?, 0)'
      ).run('Disabled', 'ticket_done', JSON.stringify({ type: 'notify', message: 'Should not fire' }));

      fireTriggers('ticket_done', {});

      const activities = db.prepare('SELECT * FROM activity').all();
      expect(activities).toHaveLength(0);
    });

    it('does not fire triggers for non-matching events', () => {
      createTrigger('ticket_failed', { type: 'notify', message: 'Failed!' });

      fireTriggers('ticket_done', {});

      const activities = db.prepare('SELECT * FROM activity').all();
      expect(activities).toHaveLength(0);
    });
  });
});
