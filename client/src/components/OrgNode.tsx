import type { Agent } from '../../shared/types';

interface OrgNodeProps {
  agent: Agent & { children?: Agent[] };
}

const statusConfig: Record<string, { dot: string; glow: string }> = {
  idle: { dot: 'bg-emerald-400', glow: 'shadow-emerald-400/50' },
  busy: { dot: 'bg-amber-400', glow: 'shadow-amber-400/50' },
  paused: { dot: 'bg-slate-400', glow: 'shadow-slate-400/30' },
  terminated: { dot: 'bg-red-500', glow: 'shadow-red-500/50' },
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

export default function OrgNode({ agent }: OrgNodeProps) {
  const hasChildren = agent.children && agent.children.length > 0;
  const status = statusConfig[agent.status] ?? statusConfig.idle;
  const initials = getInitials(agent.name);
  const avatarGradient = avatarColors[agent.id % avatarColors.length];
  const childCount = agent.children?.length ?? 0;

  return (
    <div className="flex flex-col items-center">
      {/* Node card */}
      <div className="relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-800/40 px-5 py-3.5 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-200 hover:border-slate-600/50 hover:shadow-xl hover:-translate-y-0.5">
        {/* Top accent */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/20 to-transparent" />

        <div className="flex items-center gap-3">
          {/* Avatar with status badge */}
          <div className="relative shrink-0">
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient} text-xs font-bold text-white shadow-lg ring-2 ring-white/10`}
            >
              {initials}
            </div>
            {/* Status dot */}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center">
              {agent.status === 'busy' && (
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full ${status.dot} opacity-40`}
                />
              )}
              <span
                className={`relative block h-2.5 w-2.5 rounded-full border-[1.5px] border-slate-800 ${status.dot} shadow-sm ${status.glow}`}
              />
            </span>
          </div>

          <div className="text-left">
            <div className="text-sm font-semibold text-white">
              {agent.name}
            </div>
            <div className="text-[11px] font-medium text-indigo-400">
              {agent.role}
            </div>
          </div>
        </div>
      </div>

      {/* Children tree */}
      {hasChildren && (
        <>
          {/* Vertical connector from parent */}
          <div className="relative h-7 w-px">
            <div className="absolute inset-0 bg-gradient-to-b from-slate-600/60 to-slate-600/40" />
          </div>

          <div className="relative flex gap-10">
            {/* Horizontal connector line spanning children */}
            {childCount > 1 && (
              <div
                className="absolute top-0 h-px bg-slate-600/50"
                style={{
                  left: `calc(50% / ${childCount})`,
                  right: `calc(50% / ${childCount})`,
                }}
              />
            )}

            {agent.children!.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                {/* Vertical connector to child */}
                <div className="relative h-7 w-px">
                  <div className="absolute inset-0 bg-gradient-to-b from-slate-600/40 to-slate-600/60" />
                </div>
                <OrgNode agent={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
