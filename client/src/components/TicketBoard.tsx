import {
  Inbox,
  ListTodo,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import type { Ticket } from '../../shared/types';
import TicketCard from './TicketCard';

interface TicketBoardProps {
  tickets: Ticket[];
  onUpdateTicket: (ticketId: number, data: Partial<Ticket>) => void;
  onRunTicket: (ticketId: number) => void;
}

const columns: {
  key: Ticket['status'];
  label: string;
  icon: LucideIcon;
  accent: string;
  badgeBg: string;
  badgeText: string;
  iconColor: string;
}[] = [
  {
    key: 'backlog',
    label: 'Backlog',
    icon: Inbox,
    accent: 'bg-slate-500',
    badgeBg: 'bg-slate-500/15',
    badgeText: 'text-slate-400',
    iconColor: 'text-slate-400',
  },
  {
    key: 'todo',
    label: 'To Do',
    icon: ListTodo,
    accent: 'bg-blue-500',
    badgeBg: 'bg-blue-500/15',
    badgeText: 'text-blue-400',
    iconColor: 'text-blue-400',
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    icon: Loader2,
    accent: 'bg-yellow-500',
    badgeBg: 'bg-yellow-500/15',
    badgeText: 'text-yellow-400',
    iconColor: 'text-yellow-400',
  },
  {
    key: 'review',
    label: 'Review',
    icon: Eye,
    accent: 'bg-purple-500',
    badgeBg: 'bg-purple-500/15',
    badgeText: 'text-purple-400',
    iconColor: 'text-purple-400',
  },
  {
    key: 'done',
    label: 'Done',
    icon: CheckCircle2,
    accent: 'bg-green-500',
    badgeBg: 'bg-green-500/15',
    badgeText: 'text-green-400',
    iconColor: 'text-green-400',
  },
  {
    key: 'failed',
    label: 'Failed',
    icon: XCircle,
    accent: 'bg-red-500',
    badgeBg: 'bg-red-500/15',
    badgeText: 'text-red-400',
    iconColor: 'text-red-400',
  },
];

export default function TicketBoard({
  tickets,
  onUpdateTicket,
  onRunTicket,
}: TicketBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {columns.map((col) => {
        const Icon = col.icon;
        const colTickets = tickets.filter((t) => t.status === col.key);
        return (
          <div
            key={col.key}
            className="flex w-72 shrink-0 flex-col rounded-xl border border-slate-700/50 bg-slate-900/50"
          >
            {/* Column header */}
            <div className="flex items-center gap-2.5 border-b border-slate-700/50 px-4 py-3">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-md ${col.badgeBg}`}
              >
                <Icon
                  className={`h-3.5 w-3.5 ${col.iconColor} ${
                    col.key === 'in_progress' ? 'animate-spin' : ''
                  }`}
                />
              </div>
              <span className="text-sm font-semibold text-white">
                {col.label}
              </span>
              <span
                className={`ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-xs font-medium ${col.badgeBg} ${col.badgeText}`}
              >
                {colTickets.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex flex-1 flex-col gap-2 overflow-y-auto scroll-smooth p-2.5"
              style={{ maxHeight: '70vh' }}
            >
              {colTickets.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Icon className={`mb-2 h-5 w-5 ${col.iconColor} opacity-30`} />
                  <span className="text-xs text-slate-600">No tickets</span>
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
