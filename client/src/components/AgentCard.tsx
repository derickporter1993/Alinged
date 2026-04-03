import type { Agent } from '../../shared/types';

interface AgentCardProps {
  agent: Agent;
  onUpdate: (agentId: number, data: Partial<Agent>) => void;
}

const statusDot: Record<string, string> = {
  idle: 'bg-green-400',
  busy: 'bg-yellow-400',
  paused: 'bg-gray-400',
  terminated: 'bg-red-500',
};

const roleBadge =
  'rounded-full bg-indigo-600/20 px-2.5 py-0.5 text-xs font-medium text-indigo-400';

export default function AgentCard({ agent, onUpdate }: AgentCardProps) {
  const budgetPct =
    agent.budget_limit > 0
      ? Math.min((agent.budget_spent / agent.budget_limit) * 100, 100)
      : 0;
  const budgetColor =
    budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 60 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${statusDot[agent.status]}`} />
          <h3 className="font-semibold text-slate-100">{agent.name}</h3>
        </div>
        <span className={roleBadge}>{agent.role}</span>
      </div>

      {/* Details */}
      <div className="mt-3 space-y-1 text-xs text-slate-400">
        <div>
          Model: <span className="text-slate-300">{agent.model}</span>
        </div>
        <div>
          Provider:{' '}
          <span className="text-slate-300">
            {agent.provider_name ?? `#${agent.provider_id}`}
          </span>
        </div>
        <div>
          Status: <span className="capitalize text-slate-300">{agent.status}</span>
        </div>
      </div>

      {/* Budget bar */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
          <span>Budget</span>
          <span>
            ${agent.budget_spent.toFixed(2)} / ${agent.budget_limit.toFixed(2)} (
            {budgetPct.toFixed(0)}%)
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
          <div
            className={`h-full rounded-full transition-all ${budgetColor}`}
            style={{ width: `${budgetPct}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        {agent.status !== 'terminated' && (
          <button
            onClick={() =>
              onUpdate(agent.id, {
                status: agent.status === 'paused' ? 'idle' : 'paused',
              })
            }
            className="rounded-md bg-slate-600 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-500"
          >
            {agent.status === 'paused' ? 'Resume' : 'Pause'}
          </button>
        )}
        {agent.status !== 'terminated' && (
          <button
            onClick={() => onUpdate(agent.id, { status: 'terminated' })}
            className="rounded-md bg-red-600/80 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
          >
            Fire
          </button>
        )}
      </div>
    </div>
  );
}
