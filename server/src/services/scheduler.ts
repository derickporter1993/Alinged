import cron from 'node-cron';
import { CronExpressionParser } from 'cron-parser';
import db from '../db.js';
import { getIO } from '../socket.js';

interface ScheduleRow {
  id: number;
  title: string;
  description: string | null;
  goal_id: number | null;
  agent_id: number | null;
  priority: number;
  cron_expression: string;
  enabled: number;
}

const activeJobs = new Map<number, cron.ScheduledTask>();

function computeNextRun(cronExpression: string): string | null {
  try {
    const interval = CronExpressionParser.parse(cronExpression);
    return interval.next().toISOString();
  } catch {
    return null;
  }
}

function executeSchedule(scheduleId: number) {
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as ScheduleRow | undefined;
  if (!schedule || !schedule.enabled) {
    unregisterSchedule(scheduleId);
    return;
  }

  // Create ticket from schedule template
  const ticketResult = db.prepare(`
    INSERT INTO tickets (goal_id, agent_id, title, description, priority, status)
    VALUES (?, ?, ?, ?, ?, 'todo')
  `).run(
    schedule.goal_id || null,
    schedule.agent_id || null,
    schedule.title,
    schedule.description || null,
    schedule.priority || 0
  );

  const nextRun = computeNextRun(schedule.cron_expression);

  // Update last_run and next_run
  db.prepare('UPDATE schedules SET last_run = datetime(\'now\'), next_run = ? WHERE id = ?')
    .run(nextRun, scheduleId);

  // Fetch the created ticket with joins
  const ticket = db.prepare(`
    SELECT t.*, a.name AS agent_name, g.title AS goal_title
    FROM tickets t
    LEFT JOIN agents a ON t.agent_id = a.id
    LEFT JOIN goals g ON t.goal_id = g.id
    WHERE t.id = ?
  `).get(ticketResult.lastInsertRowid);

  try {
    const io = getIO();
    io.emit('ticket:created', ticket);
    io.emit('schedule:fired', { scheduleId, ticketId: Number(ticketResult.lastInsertRowid) });
  } catch {
    // Socket may not be ready
  }

  // Log activity
  db.prepare('INSERT INTO activity (type, message, metadata) VALUES (?, ?, ?)')
    .run(
      'schedule_fired',
      `Schedule "${schedule.title}" fired, created ticket #${ticketResult.lastInsertRowid}`,
      JSON.stringify({ scheduleId, ticketId: Number(ticketResult.lastInsertRowid) })
    );

  console.log(`[Scheduler] Schedule "${schedule.title}" fired, created ticket #${ticketResult.lastInsertRowid}`);
}

export function registerSchedule(scheduleId: number): boolean {
  const schedule = db.prepare('SELECT * FROM schedules WHERE id = ?').get(scheduleId) as ScheduleRow | undefined;
  if (!schedule) return false;

  // Unregister existing job if any
  if (activeJobs.has(scheduleId)) {
    unregisterSchedule(scheduleId);
  }

  if (!schedule.enabled) return false;

  if (!cron.validate(schedule.cron_expression)) {
    console.log(`[Scheduler] Invalid cron expression for schedule #${scheduleId}: "${schedule.cron_expression}"`);
    return false;
  }

  const task = cron.schedule(schedule.cron_expression, () => {
    executeSchedule(scheduleId);
  });

  activeJobs.set(scheduleId, task);

  // Compute and store next_run
  const nextRun = computeNextRun(schedule.cron_expression);
  if (nextRun) {
    db.prepare('UPDATE schedules SET next_run = ? WHERE id = ?').run(nextRun, scheduleId);
  }

  return true;
}

export function unregisterSchedule(scheduleId: number): void {
  const task = activeJobs.get(scheduleId);
  if (task) {
    task.stop();
    activeJobs.delete(scheduleId);
  }
}

export function updateSchedule(scheduleId: number): void {
  unregisterSchedule(scheduleId);
  registerSchedule(scheduleId);
}

export function startScheduler(): void {
  const schedules = db.prepare('SELECT * FROM schedules WHERE enabled = 1').all() as ScheduleRow[];

  let registered = 0;
  for (const schedule of schedules) {
    if (registerSchedule(schedule.id)) {
      registered++;
    }
  }

  console.log(`[Scheduler] Started with ${registered} active schedule(s)`);
}

export { computeNextRun };
