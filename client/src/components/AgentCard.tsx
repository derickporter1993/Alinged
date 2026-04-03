import { Play, Pause, Trash2, Cpu } from 'lucide-react';
import type { Agent } from '../../shared/types';

interface AgentCardProps {
  agent: Agent;
  onUpdate: (agentId: number, data: Partial<Agent>) => void;
}

const statusConfig: Record<
  string,
  { dot: string; glow: string; ring: string; label: string }
> = {
  idle: {
    dot: 'bg-emerald-400',
    glow: 'shadow-emerald-400/50',
    ring: 'ring-emerald-400/20',
    label: 'Idle',
  },
  busy: {
    dot: 'bg-amber-400',
    glow: 'shadow-amber-400/50',
    ring: 'ring-amber-400/20',
    label: 'Busy',
  },
  paused: {
    dot: 'bg-slate-400',
    glow: 'shadow-slate-400/30',
    ring: 'ring-slate-400/20',
    label: 'Paused',
  },
  terminated: {
    dot: 'bg-red-500',
    glow: 'shadow-red-500/50',
    ring: 'ring-red-500/20',
    label: 'Terminated',
  },
};

const avatarColors = [
  'from-indigo-500 to-purple-600',
  'from-cyan-500 to-blue-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-600',
  'from-pink-500 to-rose-600',
  'from-violet-500 to-indigo-600',
];

function getInitials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function getAvatarColor(id: number): string {
  return avatarColors[id % avatarColors.length];
}

export default function AgentCard({ agent, onUpdate }: AgentCardProps) {
  const budgetPct =
    agent.budget_limit > 0
      ? Math.min((agent.budget_spent / agent.budget_limit) * 100, 100)
      : 0;

  const budgetBarColor =
    budgetPct >= 90
      ? 'bg-red-500 shadow-red-500/30'
      : budgetPct >= 60
        ? 'bg-amber-500 shadow-amber-500/20'
        : 'bg-emerald-500 shadow-emerald-500/20';

  const status = statusConfig[agent.status] ?? statusConfig.idle;
  const initials = getInitials(agent.name);
  const avatarGradient = getAvatarColor(agent.id);
  const isTerminated = agent.status === 'terminated';

  return (
    <div
      className={`group relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-800/40 p-5 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-200 hover:border-slate-600/50 hover:shadow-xl hover:shadow-black/30 hover:-translate-y-0.5 ${
        isTerminated ? 'opacity-60' : ''
      }`}
    >
      {/* Subtle top gradient accent */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

      {/* Header */}
      <div className="flex items-center gap-3.5">
        {/* Avatar with status badge */}
        <div className="relative shrink-0">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient} text-sm font-bold text-white shadow-lg ring-2 ring-white/10`}
          >
            {initials}
          </div>
          {/* Status indicator on avatar */}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center">
            {agent.status === 'busy' && (
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full ${status.dot} opacity-40`}
              />
            )}
            <span
              className={`relative block h-3 w-3 rounded-full border-2 border-slate-800 ${status.dot} shadow-sm ${status.glow}`}
            />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">
            {agent.name}
          </h3>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-indigo-500/10 px-1.5 py-0.5 text-[11px] font-medium text-indigo-400 ring-1 ring-indigo-500/20">
              {agent.role}
            </span>
            <span className="text-[11px] capitalize text-slate-500">
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* Details grid */}
      <div className="mt-4 space-y-2 rounded-lg bg-slate-900/40 px-3.5 py-3 ring-1 ring-white/[0.03]">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-500">
            <Cpu className="h-3 w-3" />
            Model
          </span>
          <span className="truncate pl-2 text-right font-mono text-slate-300">
            {agent.model}
          </span>
        </div>
        <div className="h-px bg-slate-700/30" />
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500">Provider</span>
          <span className="truncate pl-2 text-right text-slate-300">
            {agent.provider_name ?? `#${agent.provider_id}`}
          </span>
        </div>
      </div>

      {/* Budget bar */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-400">Budget</span>
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-semibold text-white">
              ${agent.budget_spent.toFixed(2)}
            </span>
            <span className="text-[11px] text-slate-500">
              / ${agent.budget_limit.toFixed(2)}
            </span>
          </div>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-700/60">
          <div
            className={`h-full rounded-full shadow-sm transition-all duration-500 ease-out ${budgetBarColor}`}
            style={{ width: `${budgetPct}%` }}
          />
        </div>
        <div className="mt-1 text-right text-[11px] font-medium text-slate-500">
          {budgetPct.toFixed(0)}% used
        </div>
      </div>

      {/* Actions */}
      {!isTerminated && (
        <div className="mt-4 flex gap-2 border-t border-slate-700/40 pt-4">
          <button
            onClick={() =>
              onUpdate(agent.id, {
                status: agent.status === 'paused' ? 'idle' : 'paused',
              })
            }
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-700/50 px-3 py-2 text-xs font-medium text-slate-300 ring-1 ring-white/5 transition-all duration-200 hover:bg-slate-600/60 hover:text-white"
          >
            {agent.status === 'paused' ? (
              <>
                <Play className="h-3.5 w-3.5" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5" />
                Pause
              </>
            )}
          </button>
          <button
            onClick={() => onUpdate(agent.id, { status: 'terminated' })}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-400 ring-1 ring-red-500/20 transition-all duration-200 hover:bg-red-500/20 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Fire
          </button>
        </div>
      )}
    </div>
  );
}
