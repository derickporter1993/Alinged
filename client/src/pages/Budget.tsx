import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchApi } from '../api';
import StatCard from '../components/StatCard';
import CostMeter from '../components/CostMeter';
import type { BudgetSummary, CostLog } from '../../shared/types';

export default function Budget() {
  const { data: summary, loading: summaryLoading, error: summaryError, refetch: refetchSummary } =
    useFetch<BudgetSummary>('/api/budget/summary');
  const { data: logs, loading: logsLoading, error: logsError } =
    useFetch<CostLog[]>('/api/budget/logs');

  const [showProviderForm, setShowProviderForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [providerForm, setProviderForm] = useState({
    name: 'anthropic',
    api_key: '',
  });

  async function handleAddProvider(e: React.FormEvent) {
    e.preventDefault();
    if (!providerForm.api_key.trim()) return;
    setSubmitting(true);
    try {
      await fetchApi('/api/providers', {
        method: 'POST',
        body: JSON.stringify({
          name: providerForm.name,
          api_key: providerForm.api_key.trim(),
        }),
      });
      setProviderForm({ name: 'anthropic', api_key: '' });
      setShowProviderForm(false);
      refetchSummary();
    } catch (err) {
      console.error('Failed to add provider:', err);
    } finally {
      setSubmitting(false);
    }
  }

  const loading = summaryLoading || logsLoading;
  const error = summaryError || logsError;

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-400">Loading budget data...</div>
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
        <h1 className="text-2xl font-bold text-slate-100">Budget</h1>
        <button
          onClick={() => setShowProviderForm(!showProviderForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          {showProviderForm ? 'Cancel' : 'Add Provider'}
        </button>
      </div>

      {/* Add provider form */}
      {showProviderForm && (
        <form
          onSubmit={handleAddProvider}
          className="rounded-lg border border-slate-700 bg-slate-800 p-5 space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Provider
              </label>
              <select
                value={providerForm.name}
                onChange={(e) =>
                  setProviderForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                API Key
              </label>
              <input
                type="password"
                value={providerForm.api_key}
                onChange={(e) =>
                  setProviderForm((prev) => ({ ...prev, api_key: e.target.value }))
                }
                placeholder="sk-..."
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Provider'}
          </button>
        </form>
      )}

      {/* Top stats */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            title="Total Spent"
            value={`$${summary.totalSpent.toFixed(2)}`}
            color="border-green-500"
          />
          <StatCard
            title="Spent Today"
            value={`$${summary.spentToday.toFixed(2)}`}
            color="border-blue-500"
          />
          <StatCard
            title="Spent This Week"
            value={`$${summary.spentThisWeek.toFixed(2)}`}
            color="border-indigo-500"
          />
        </div>
      )}

      {/* Per-agent cost meters */}
      {summary && summary.byAgent.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-200">
            Agent Budgets
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {summary.byAgent.map((entry) => (
              <CostMeter
                key={entry.agent_id}
                label={entry.agent_name}
                spent={entry.spent}
                limit={entry.limit}
              />
            ))}
          </div>
        </div>
      )}

      {/* Recent cost logs */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-slate-200">
          Recent Cost Logs
        </h2>
        {!logs || logs.length === 0 ? (
          <div className="rounded-lg border border-slate-700 bg-slate-800 py-8 text-center">
            <div className="text-slate-500">No cost logs yet</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-800/80">
                  <th className="px-4 py-3 text-left font-medium text-slate-400">
                    Time
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">
                    Provider
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-slate-400">
                    Model
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-400">
                    Input Tokens
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-400">
                    Output Tokens
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-slate-400">
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="bg-slate-800/40 transition-colors hover:bg-slate-800/70"
                  >
                    <td className="whitespace-nowrap px-4 py-2.5 text-slate-400">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">{log.provider}</td>
                    <td className="px-4 py-2.5 text-slate-300">{log.model}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400">
                      {log.input_tokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right text-slate-400">
                      {log.output_tokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-200">
                      ${log.cost_usd.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
