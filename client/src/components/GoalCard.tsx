import {
  CheckCircle2,
  Pause,
  Circle,
  Sparkles,
  SplitSquareVertical,
  Calendar,
} from 'lucide-react';
import type { Goal } from '../../shared/types';

interface GoalCardProps {
  goal: Goal;
  onDecompose: (goalId: number) => void;
  onUpdate: (goalId: number, data: Partial<Goal>) => void;
}

const statusConfig: Record<
  string,
  {
    bg: string;
    text: string;
    ring: string;
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  active: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    ring: 'ring-emerald-500/20',
    icon: Circle,
    label: 'Active',
  },
  completed: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    ring: 'ring-blue-500/20',
    icon: CheckCircle2,
    label: 'Completed',
  },
  paused: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    ring: 'ring-amber-500/20',
    icon: Pause,
    label: 'Paused',
  },
};

export default function GoalCard({
  goal,
  onDecompose,
  onUpdate,
}: GoalCardProps) {
  const status = statusConfig[goal.status] ?? statusConfig.active;
  const StatusIcon = status.icon;
  const isAutopilot = goal.autopilot === 1;

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-800/40 p-5 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-200 hover:border-slate-600/50 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5">
      {/* Top accent line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold leading-snug text-white">
            {goal.title}
          </h3>
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ${status.bg} ${status.text} ${status.ring}`}
        >
          <StatusIcon className="h-3.5 w-3.5" />
          {status.label}
        </span>
      </div>

      {/* Description */}
      {goal.description && (
        <p className="mt-2.5 line-clamp-2 text-sm leading-relaxed text-slate-400">
          {goal.description}
        </p>
      )}

      {/* Metadata */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <Calendar className="h-3 w-3" />
        Created {new Date(goal.created_at).toLocaleDateString()}
      </div>

      {/* Controls */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-700/40 pt-4">
        {/* Autopilot toggle */}
        <button
          onClick={() =>
            onUpdate(goal.id, { autopilot: isAutopilot ? 0 : 1 })
          }
          className="group/toggle inline-flex items-center gap-2.5 text-xs"
        >
          <div
            className={`relative h-[22px] w-10 rounded-full transition-all duration-300 ${
              isAutopilot
                ? 'bg-indigo-600 shadow-sm shadow-indigo-500/30'
                : 'bg-slate-600'
            }`}
          >
            <div
              className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-300 ease-out ${
                isAutopilot ? 'left-[21px]' : 'left-[3px]'
              }`}
            />
          </div>
          <span className="flex items-center gap-1 font-medium text-slate-400 transition-colors group-hover/toggle:text-slate-300">
            <Sparkles
              className={`h-3.5 w-3.5 transition-colors ${
                isAutopilot ? 'text-indigo-400' : ''
              }`}
            />
            Autopilot
          </span>
        </button>

        <div className="h-5 w-px bg-slate-700/50" />

        {/* Status select */}
        <select
          value={goal.status}
          onChange={(e) =>
            onUpdate(goal.id, {
              status: e.target.value as Goal['status'],
            })
          }
          className="rounded-lg border border-slate-600/50 bg-slate-700/50 px-2.5 py-1.5 text-xs text-slate-300 transition-all duration-200 hover:bg-slate-700/70 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
        >
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="paused">Paused</option>
        </select>

        <div className="flex-1" />

        {/* Decompose button */}
        <button
          onClick={() => onDecompose(goal.id)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-md hover:shadow-indigo-500/25"
        >
          <SplitSquareVertical className="h-3.5 w-3.5" />
          Decompose
        </button>
      </div>
    </div>
  );
}
