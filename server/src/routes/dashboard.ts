import { Router } from 'express';
import db from '../db.js';

const router = Router();

// GET / - dashboard summary
router.get('/', (_req, res) => {
  const activeGoals = db.prepare(
    `SELECT COUNT(*) AS count FROM goals WHERE status = 'active'`
  ).get() as { count: number };

  const busyAgents = db.prepare(
    `SELECT COUNT(*) AS count FROM agents WHERE status = 'busy'`
  ).get() as { count: number };

  const openTickets = db.prepare(
    `SELECT COUNT(*) AS count FROM tickets WHERE status NOT IN ('done', 'failed')`
  ).get() as { count: number };

  const totalSpent = db.prepare(
    `SELECT COALESCE(SUM(cost_usd), 0) AS total FROM cost_logs`
  ).get() as { total: number };

  const ticketsByStatus = db.prepare(`
    SELECT status, COUNT(*) AS count
    FROM tickets
    GROUP BY status
  `).all() as { status: string; count: number }[];

  const ticketStatusMap: Record<string, number> = {};
  for (const row of ticketsByStatus) {
    ticketStatusMap[row.status] = row.count;
  }

  const recentActivity = db.prepare(
    `SELECT * FROM activity ORDER BY created_at DESC LIMIT 20`
  ).all();

  res.json({
    activeGoals: activeGoals.count,
    busyAgents: busyAgents.count,
    openTickets: openTickets.count,
    totalSpent: totalSpent.total,
    ticketsByStatus: ticketStatusMap,
    recentActivity,
  });
});

export default router;
