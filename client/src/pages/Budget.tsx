import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchApi } from '../api';
import StatCard from '../components/StatCard';
import CostMeter from '../components/CostMeter';
import { DollarSign, TrendingUp, Calendar, Wallet, Plus, Key } from 'lucide-react';
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
        <div className="flex items-center gap-3">
          <Wallet className="h-7 w-7 text-indigo-400" />
          <h1 className="text-2xl font-bold text-white">Budget</h1>
        </div>
        <button
          onClick={() => setShowProviderForm(!showProviderForm)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30"
        >
          {showProviderForm ? (
            'Cancel'
          ) : (
            <>
              <Plus className="h-4 w-4" />
              Add Provider
            </>
          )}
        </button>
      </div>

      {/* Add provider form */}
      {showProviderForm && (
        <form
          onSubmit={handleAddProvider}
          className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-lg shadow-black/20 space-y-4"
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
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="anthropic">Anthropic</option>
                <option value="openai">OpenAI</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-sm font-medium text-slate-300">
                <Key className="h-3.5 w-3.5 text-slate-500" />
                API Key
              </label>
              <input
                type="password"
                value={providerForm.api_key}
                onChange={(e) =>
                  setProviderForm((prev) => ({ ...prev, api_key: e.target.value }))
                }
                placeholder="sk-..."
                className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30 disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Provider'}
          </button>
        </form>
      )}

      {/* Top stats */}
      {summary && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Spent"
            value={`$${summary.totalSpent.toFixed(2)}`}
            color="text-green-400"
            icon={DollarSign}
          />
          <StatCard
            label="Spent Today"
            value={`$${summary.spentToday.toFixed(2)}`}
            color="text-blue-400"
            icon={TrendingUp}
          />
          <StatCard
            label="Spent This Week"
            value={`$${summary.spentThisWeek.toFixed(2)}`}
            color="text-indigo-400"
            icon={Calendar}
          />
        </div>
      )}

      {/* Per-agent cost meters */}
      {summary && summary.byAgent.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-white">
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
        <h2 className="mb-3 text-lg font-semibold text-white">
          Recent Cost Logs
        </h2>
        {!logs || logs.length === 0 ? (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center shadow-lg shadow-black/20">
            <div className="text-slate-500">No cost logs yet</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-700/50 shadow-lg shadow-black/20">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 bg-slate-800/50">
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
                    className="bg-slate-800/30 transition-all duration-200 hover:bg-slate-800/70"
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
                    <td className="px-4 py-2.5 text-right font-medium text-white">
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
