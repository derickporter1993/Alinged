import { useCallback } from 'react';
import {
  Target,
  Bot,
  Ticket,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Zap,
  Activity as ActivityIcon,
  BarChart3,
  Inbox,
} from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useSocket } from '../hooks/useSocket';
import StatCard from '../components/StatCard';
import type { DashboardData, Activity } from '../../shared/types';

const statusColors: Record<string, string> = {
  backlog: 'bg-slate-500',
  todo: 'bg-blue-500',
  in_progress: 'bg-amber-500',
  review: 'bg-purple-500',
  done: 'bg-emerald-500',
  failed: 'bg-red-500',
};

const statusLabels: Record<string, string> = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  failed: 'Failed',
};

function getActivityIcon(type: string) {
  switch (type) {
    case 'goal':
      return { icon: CheckCircle2, color: 'text-indigo-400', bg: 'bg-indigo-500/10' };
    case 'agent':
      return { icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
    case 'ticket':
      return { icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-500/10' };
    case 'budget':
      return { icon: Clock, color: 'text-violet-400', bg: 'bg-violet-500/10' };
    default:
      return { icon: ActivityIcon, color: 'text-slate-400', bg: 'bg-slate-500/10' };
  }
}

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function Dashboard() {
  const { data, loading, error, refetch } = useFetch<DashboardData>('/api/dashboard');

  const onActivity = useCallback(() => {
    refetch();
  }, [refetch]);

  useSocket('activity:new', onActivity);

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-8 py-6">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-red-400">Error: {error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const totalTickets = Object.values(data.ticketsByStatus).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Dashboard
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Monitor your agents, goals, and system health at a glance.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Goals"
          value={data.activeGoals}
          icon={Target}
          color="text-indigo-400"
        />
        <StatCard
          label="Busy Agents"
          value={data.busyAgents}
          icon={Bot}
          color="text-emerald-400"
        />
        <StatCard
          label="Open Tickets"
          value={data.openTickets}
          icon={Ticket}
          color="text-amber-400"
        />
        <StatCard
          label="Total Spent"
          value={`$${data.totalSpent.toFixed(2)}`}
          icon={DollarSign}
          color="text-violet-400"
        />
      </div>

      {/* Ticket status breakdown */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-lg shadow-black/20">
        <div className="mb-5 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-white">
            Ticket Status Breakdown
          </h2>
          {totalTickets > 0 && (
            <span className="ml-auto text-xs text-slate-500">
              {totalTickets} total ticket{totalTickets !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {totalTickets === 0 ? (
          <div className="flex flex-col items-center justify-center py-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-700/30">
              <Inbox className="h-6 w-6 text-slate-500" />
            </div>
            <p className="mt-3 text-sm font-medium text-slate-400">No tickets yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Tickets will appear here once goals generate work.
            </p>
          </div>
        ) : (
          <>
            {/* Stacked bar chart */}
            <div className="flex h-5 w-full overflow-hidden rounded-full bg-slate-900/50">
              {Object.entries(data.ticketsByStatus).map(([status, count]) => {
                const pct = (count / totalTickets) * 100;
                if (pct === 0) return null;
                return (
                  <div
                    key={status}
                    className={`${statusColors[status] ?? 'bg-slate-600'} transition-all duration-500 first:rounded-l-full last:rounded-r-full`}
                    style={{ width: `${pct}%` }}
                    title={`${statusLabels[status] ?? status}: ${count} (${pct.toFixed(1)}%)`}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
              {Object.entries(data.ticketsByStatus).map(([status, count]) => {
                const pct = totalTickets > 0 ? ((count / totalTickets) * 100).toFixed(1) : '0';
                return (
                  <div
                    key={status}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${statusColors[status] ?? 'bg-slate-600'}`}
                    />
                    <span className="text-slate-400">
                      {statusLabels[status] ?? status}
                    </span>
                    <span className="font-semibold text-slate-300">{count}</span>
                    <span className="text-slate-500">({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Activity feed */}
      <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-lg shadow-black/20">
        <div className="mb-5 flex items-center gap-2">
          <ActivityIcon className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-white">
            Recent Activity
          </h2>
          {data.recentActivity.length > 0 && (
            <span className="ml-auto text-xs text-slate-500">
              {data.recentActivity.length} event{data.recentActivity.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
          {data.recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-700/30">
                <Clock className="h-6 w-6 text-slate-500" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-400">No activity yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Events from agents, goals, and tickets will appear here.
              </p>
            </div>
          ) : (
            data.recentActivity.map((act: Activity) => {
              const { icon: Icon, color, bg } = getActivityIcon(act.type);
              return (
                <div
                  key={act.id}
                  className="group flex items-start gap-3 rounded-lg border border-slate-700/30 bg-slate-900/30 px-4 py-3 transition-colors hover:border-slate-700/50 hover:bg-slate-900/50"
                >
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${bg}`}
                  >
                    <Icon className={`h-3.5 w-3.5 ${color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-slate-300">
                      {act.message}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="rounded-md bg-slate-700/40 px-1.5 py-0.5 text-[10px] font-medium capitalize text-slate-500">
                        {act.type}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 pt-0.5 text-xs text-slate-500">
                    {formatTimestamp(act.created_at)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
