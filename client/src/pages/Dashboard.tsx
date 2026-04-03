import { useCallback } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useSocket } from '../hooks/useSocket';
import StatCard from '../components/StatCard';
import type { DashboardData, Activity } from '../../shared/types';

const statusColors: Record<string, string> = {
  backlog: 'bg-slate-500',
  todo: 'bg-blue-500',
  in_progress: 'bg-yellow-500',
  review: 'bg-purple-500',
  done: 'bg-green-500',
  failed: 'bg-red-500',
};

const typeBadge: Record<string, string> = {
  goal: 'bg-indigo-600/20 text-indigo-400',
  agent: 'bg-green-600/20 text-green-400',
  ticket: 'bg-blue-600/20 text-blue-400',
  budget: 'bg-yellow-600/20 text-yellow-400',
};

export default function Dashboard() {
  const { data, loading, error, refetch } = useFetch<DashboardData>('/api/dashboard');

  const onActivity = useCallback(() => {
    refetch();
  }, [refetch]);

  useSocket('activity:new', onActivity);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (!data) return null;

  const totalTickets = Object.values(data.ticketsByStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Goals"
          value={data.activeGoals}
          color="border-indigo-500"
        />
        <StatCard
          title="Busy Agents"
          value={data.busyAgents}
          color="border-yellow-500"
        />
        <StatCard
          title="Open Tickets"
          value={data.openTickets}
          color="border-blue-500"
        />
        <StatCard
          title="Total Spent"
          value={`$${data.totalSpent.toFixed(2)}`}
          color="border-green-500"
        />
      </div>

      {/* Ticket status breakdown */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-300">
          Ticket Status Breakdown
        </h2>
        {totalTickets === 0 ? (
          <div className="text-sm text-slate-500">No tickets yet</div>
        ) : (
          <>
            <div className="flex h-4 w-full overflow-hidden rounded-full">
              {Object.entries(data.ticketsByStatus).map(([status, count]) => {
                const pct = (count / totalTickets) * 100;
                if (pct === 0) return null;
                return (
                  <div
                    key={status}
                    className={`${statusColors[status] ?? 'bg-slate-600'} transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${status}: ${count}`}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-3">
              {Object.entries(data.ticketsByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${statusColors[status] ?? 'bg-slate-600'}`}
                  />
                  <span className="capitalize">{status.replace('_', ' ')}</span>
                  <span className="font-medium text-slate-300">{count}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Activity feed */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-300">
          Recent Activity
        </h2>
        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {data.recentActivity.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              No activity yet
            </div>
          ) : (
            data.recentActivity.map((act: Activity) => (
              <div
                key={act.id}
                className="flex items-start gap-3 rounded-md border border-slate-700/50 bg-slate-900/40 px-3 py-2.5"
              >
                <span
                  className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadge[act.type] ?? 'bg-slate-600/30 text-slate-400'}`}
                >
                  {act.type}
                </span>
                <span className="flex-1 text-sm text-slate-300">
                  {act.message}
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {new Date(act.created_at).toLocaleTimeString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
