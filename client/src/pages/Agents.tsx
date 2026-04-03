import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchApi } from '../api';
import AgentCard from '../components/AgentCard';
import type { Agent, Provider } from '../../shared/types';

export default function Agents() {
  const { data: agents, loading, error, refetch } = useFetch<Agent[]>('/api/agents');
  const { data: providers } = useFetch<Provider[]>('/api/providers');

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    role: '',
    provider_id: '',
    model: '',
    system_prompt: '',
    reports_to: '',
    budget_limit: '10',
  });

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.provider_id) return;
    setSubmitting(true);
    try {
      await fetchApi('/api/agents', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role.trim(),
          provider_id: Number(form.provider_id),
          model: form.model.trim(),
          system_prompt: form.system_prompt.trim() || null,
          reports_to: form.reports_to ? Number(form.reports_to) : null,
          budget_limit: Number(form.budget_limit) || 10,
        }),
      });
      setForm({
        name: '',
        role: '',
        provider_id: '',
        model: '',
        system_prompt: '',
        reports_to: '',
        budget_limit: '10',
      });
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error('Failed to hire agent:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdate(agentId: number, data: Partial<Agent>) {
    try {
      await fetchApi(`/api/agents/${agentId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      refetch();
    } catch (err) {
      console.error('Failed to update agent:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-400">Loading agents...</div>
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Agents</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          {showForm ? 'Cancel' : 'Hire Agent'}
        </button>
      </div>

      {/* Hire form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-slate-700 bg-slate-800 p-5 space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Agent name..."
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Role
              </label>
              <input
                type="text"
                value={form.role}
                onChange={(e) => updateField('role', e.target.value)}
                placeholder="e.g. developer, researcher..."
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Provider
              </label>
              <select
                value={form.provider_id}
                onChange={(e) => updateField('provider_id', e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="">Select provider...</option>
                {providers?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Model
              </label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => updateField('model', e.target.value)}
                placeholder="e.g. gpt-4o, claude-sonnet-4-20250514..."
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Reports To
              </label>
              <select
                value={form.reports_to}
                onChange={(e) => updateField('reports_to', e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">None (top-level)</option>
                {agents?.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Budget Limit ($)
              </label>
              <input
                type="number"
                value={form.budget_limit}
                onChange={(e) => updateField('budget_limit', e.target.value)}
                min="0"
                step="0.01"
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              System Prompt
            </label>
            <textarea
              value={form.system_prompt}
              onChange={(e) => updateField('system_prompt', e.target.value)}
              placeholder="Optional system prompt for the agent..."
              rows={3}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Hiring...' : 'Hire Agent'}
          </button>
        </form>
      )}

      {/* Agent grid */}
      {agents && agents.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800 py-12 text-center">
          <div className="text-slate-500">No agents yet. Hire one to get started.</div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {agents?.map((agent) => (
            <AgentCard key={agent.id} agent={agent} onUpdate={handleUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}
