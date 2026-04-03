import { useFetch } from '../hooks/useFetch';
import OrgNode from '../components/OrgNode';
import { Network } from 'lucide-react';
import type { Agent } from '../../shared/types';

export default function OrgChart() {
  const { data: tree, loading, error } = useFetch<Agent[]>('/api/agents?tree=true');

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-400">Loading org chart...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Network className="h-7 w-7 text-indigo-400" />
        <h1 className="text-2xl font-bold text-white">Organization Chart</h1>
      </div>

      {!tree || tree.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center shadow-lg shadow-black/20">
          <Network className="mx-auto mb-3 h-10 w-10 text-slate-600" />
          <div className="text-slate-500">
            No agents in the organization yet. Hire agents to build your org chart.
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/50 p-8 shadow-lg shadow-black/20 backdrop-blur-sm">
          <div className="flex items-start justify-center gap-12">
            {tree.map((root) => (
              <OrgNode key={root.id} agent={root} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
