import type { Agent } from '../../shared/types';

interface OrgNodeProps {
  agent: Agent;
}

const statusDot: Record<string, string> = {
  idle: 'bg-green-400',
  busy: 'bg-yellow-400',
  paused: 'bg-gray-400',
  terminated: 'bg-red-500',
};

export default function OrgNode({ agent }: OrgNodeProps) {
  const hasChildren = agent.children && agent.children.length > 0;

  return (
    <div className="flex flex-col items-center">
      {/* Node */}
      <div className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-2">
          <span className={`h-2 w-2 rounded-full ${statusDot[agent.status]}`} />
          <span className="text-sm font-semibold text-slate-100">
            {agent.name}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-indigo-400">{agent.role}</div>
      </div>

      {/* Children */}
      {hasChildren && (
        <>
          {/* Vertical connector */}
          <div className="h-6 w-px bg-slate-600" />

          {/* Horizontal connector + children */}
          <div className="relative flex gap-6">
            {/* Horizontal line */}
            {agent.children!.length > 1 && (
              <div className="absolute top-0 left-[calc(50%-(var(--line-w)/2))] h-px bg-slate-600"
                style={{
                  left: '0',
                  right: '0',
                  width: '100%',
                }}
              />
            )}
            {agent.children!.map((child) => (
              <div key={child.id} className="flex flex-col items-center">
                <div className="h-6 w-px bg-slate-600" />
                <OrgNode agent={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
