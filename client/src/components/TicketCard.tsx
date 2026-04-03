import {
  ListTodo,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Archive,
  Play,
  User,
  Target,
} from 'lucide-react';
import type { Ticket } from '../../shared/types';

interface TicketCardProps {
  ticket: Ticket;
  onUpdate: (ticketId: number, data: Partial<Ticket>) => void;
  onRun: (ticketId: number) => void;
}

const priorityConfig: Record<
  number,
  { accent: string; badge: string; dot: string; label: string }
> = {
  0: {
    accent: 'border-l-slate-500/40',
    badge: 'bg-slate-500/10 text-slate-400 ring-slate-500/20',
    dot: 'bg-slate-400',
    label: 'Low',
  },
  1: {
    accent: 'border-l-blue-500/60',
    badge: 'bg-blue-500/10 text-blue-400 ring-blue-500/20',
    dot: 'bg-blue-400',
    label: 'Medium',
  },
  2: {
    accent: 'border-l-orange-500/60',
    badge: 'bg-orange-500/10 text-orange-400 ring-orange-500/20',
    dot: 'bg-orange-400',
    label: 'High',
  },
  3: {
    accent: 'border-l-red-500/60',
    badge: 'bg-red-500/10 text-red-400 ring-red-500/20',
    dot: 'bg-red-400',
    label: 'Critical',
  },
};

const statusConfig: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>;
    text: string;
    bg: string;
    label: string;
  }
> = {
  backlog: {
    icon: Archive,
    text: 'text-slate-500',
    bg: 'bg-slate-500/10',
    label: 'Backlog',
  },
  todo: {
    icon: ListTodo,
    text: 'text-slate-400',
    bg: 'bg-slate-400/10',
    label: 'To Do',
  },
  in_progress: {
    icon: Loader2,
    text: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    label: 'In Progress',
  },
  review: {
    icon: Eye,
    text: 'text-amber-400',
    bg: 'bg-amber-500/10',
    label: 'Review',
  },
  done: {
    icon: CheckCircle2,
    text: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    label: 'Done',
  },
  failed: {
    icon: XCircle,
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    label: 'Failed',
  },
};

const allStatuses: Ticket['status'][] = [
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done',
  'failed',
];

export default function TicketCard({
  ticket,
  onUpdate,
  onRun,
}: TicketCardProps) {
  const priority = priorityConfig[ticket.priority] ?? priorityConfig[0];
  const status = statusConfig[ticket.status] ?? statusConfig.backlog;
  const StatusIcon = status.icon;

  const canRun =
    ticket.agent_id !== null &&
    (ticket.status === 'todo' || ticket.status === 'backlog');

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-l-[3px] border-slate-700/50 ${priority.accent} bg-gradient-to-br from-slate-800/80 to-slate-800/40 p-4 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-200 hover:border-slate-600/50 hover:shadow-xl hover:shadow-black/30`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <StatusIcon
            className={`mt-0.5 h-4 w-4 shrink-0 ${status.text} ${
              ticket.status === 'in_progress' ? 'animate-spin' : ''
            }`}
          />
          <h4 className="text-sm font-semibold leading-tight text-white">
            {ticket.title}
          </h4>
        </div>
        <span
          className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ${priority.badge}`}
        >
          {priority.label}
        </span>
      </div>

      {/* Metadata tags */}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        {ticket.agent_name && (
          <div className="inline-flex items-center gap-1 rounded-md bg-slate-900/50 px-2 py-1 text-slate-400 ring-1 ring-white/[0.04]">
            <User className="h-3 w-3 text-slate-500" />
            {ticket.agent_name}
          </div>
        )}
        {ticket.goal_title && (
          <div className="inline-flex items-center gap-1 rounded-md bg-slate-900/50 px-2 py-1 text-slate-400 ring-1 ring-white/[0.04]">
            <Target className="h-3 w-3 text-slate-500" />
            <span className="max-w-[140px] truncate">{ticket.goal_title}</span>
          </div>
        )}
      </div>

      {/* Result preview */}
      {ticket.result && (
        <div className="mt-3 line-clamp-2 rounded-lg bg-slate-900/50 p-2.5 text-xs leading-relaxed text-slate-400 ring-1 ring-white/[0.03]">
          {ticket.result}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2 border-t border-slate-700/30 pt-3">
        <select
          value={ticket.status}
          onChange={(e) =>
            onUpdate(ticket.id, {
              status: e.target.value as Ticket['status'],
            })
          }
          className="rounded-lg border border-slate-600/50 bg-slate-700/50 px-2 py-1.5 text-xs text-slate-300 transition-all duration-200 hover:bg-slate-700/70 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        >
          {allStatuses.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>

        {canRun && (
          <button
            onClick={() => onRun(ticket.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-md"
          >
            <Play className="h-3 w-3" />
            Run
          </button>
        )}
      </div>
    </div>
  );
}
