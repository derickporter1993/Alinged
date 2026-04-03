import type { Ticket } from '../../shared/types';

interface TicketCardProps {
  ticket: Ticket;
  onUpdate: (ticketId: number, data: Partial<Ticket>) => void;
  onRun: (ticketId: number) => void;
}

const priorityBadge: Record<number, string> = {
  0: 'bg-slate-600/40 text-slate-400',
  1: 'bg-blue-600/20 text-blue-400',
  2: 'bg-orange-600/20 text-orange-400',
  3: 'bg-red-600/20 text-red-400',
};

const priorityLabel: Record<number, string> = {
  0: 'Low',
  1: 'Medium',
  2: 'High',
  3: 'Critical',
};

const allStatuses: Ticket['status'][] = [
  'backlog',
  'todo',
  'in_progress',
  'review',
  'done',
  'failed',
];

export default function TicketCard({ ticket, onUpdate, onRun }: TicketCardProps) {
  const canRun =
    ticket.agent_id !== null &&
    (ticket.status === 'todo' || ticket.status === 'backlog');

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/80 p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-medium text-slate-200 leading-tight">
          {ticket.title}
        </h4>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${priorityBadge[ticket.priority] ?? priorityBadge[0]}`}
        >
          {priorityLabel[ticket.priority] ?? 'Low'}
        </span>
      </div>

      <div className="mt-2 space-y-0.5 text-xs text-slate-500">
        {ticket.agent_name && (
          <div>
            Agent: <span className="text-slate-400">{ticket.agent_name}</span>
          </div>
        )}
        {ticket.goal_title && (
          <div>
            Goal: <span className="text-slate-400">{ticket.goal_title}</span>
          </div>
        )}
      </div>

      {ticket.result && (
        <div className="mt-2 line-clamp-2 rounded bg-slate-900/60 p-2 text-xs text-slate-400">
          {ticket.result}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <select
          value={ticket.status}
          onChange={(e) =>
            onUpdate(ticket.id, { status: e.target.value as Ticket['status'] })
          }
          className="rounded border border-slate-600 bg-slate-700 px-1.5 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
          >
            Run
          </button>
        )}
      </div>
    </div>
  );
}
