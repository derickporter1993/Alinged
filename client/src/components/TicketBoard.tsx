import type { Ticket } from '../../shared/types';
import TicketCard from './TicketCard';

interface TicketBoardProps {
  tickets: Ticket[];
  onUpdateTicket: (ticketId: number, data: Partial<Ticket>) => void;
  onRunTicket: (ticketId: number) => void;
}

const columns: { key: Ticket['status']; label: string; accent: string }[] = [
  { key: 'backlog', label: 'Backlog', accent: 'bg-slate-500' },
  { key: 'todo', label: 'To Do', accent: 'bg-blue-500' },
  { key: 'in_progress', label: 'In Progress', accent: 'bg-yellow-500' },
  { key: 'review', label: 'Review', accent: 'bg-purple-500' },
  { key: 'done', label: 'Done', accent: 'bg-green-500' },
  { key: 'failed', label: 'Failed', accent: 'bg-red-500' },
];

export default function TicketBoard({
  tickets,
  onUpdateTicket,
  onRunTicket,
}: TicketBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const colTickets = tickets.filter((t) => t.status === col.key);
        return (
          <div
            key={col.key}
            className="flex w-64 shrink-0 flex-col rounded-lg border border-slate-700 bg-slate-900/50"
          >
            {/* Column header */}
            <div className="flex items-center gap-2 border-b border-slate-700 px-3 py-2.5">
              <span className={`h-2 w-2 rounded-full ${col.accent}`} />
              <span className="text-sm font-medium text-slate-300">
                {col.label}
              </span>
              <span className="ml-auto rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                {colTickets.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
              {colTickets.length === 0 && (
                <div className="py-6 text-center text-xs text-slate-600">
                  No tickets
                </div>
              )}
              {colTickets.map((ticket) => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onUpdate={onUpdateTicket}
                  onRun={onRunTicket}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
