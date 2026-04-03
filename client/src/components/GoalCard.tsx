import type { Goal } from '../../shared/types';

interface GoalCardProps {
  goal: Goal;
  onDecompose: (goalId: number) => void;
  onUpdate: (goalId: number, data: Partial<Goal>) => void;
}

const statusColors: Record<string, string> = {
  active: 'bg-green-600/20 text-green-400',
  completed: 'bg-blue-600/20 text-blue-400',
  paused: 'bg-yellow-600/20 text-yellow-400',
};

export default function GoalCard({ goal, onDecompose, onUpdate }: GoalCardProps) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-100">{goal.title}</h3>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[goal.status] ?? 'bg-slate-600 text-slate-300'}`}
        >
          {goal.status}
        </span>
      </div>

      {goal.description && (
        <p className="mt-2 line-clamp-2 text-sm text-slate-400">
          {goal.description}
        </p>
      )}

      <div className="mt-3 text-xs text-slate-500">
        Created {new Date(goal.created_at).toLocaleDateString()}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => onDecompose(goal.id)}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-500"
        >
          Decompose into Tasks
        </button>

        <select
          value={goal.status}
          onChange={(e) =>
            onUpdate(goal.id, {
              status: e.target.value as Goal['status'],
            })
          }
          className="rounded-md border border-slate-600 bg-slate-700 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="paused">Paused</option>
        </select>
      </div>
    </div>
  );
}
