import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchApi } from '../api';
import type { AgentScore, Ticket } from '../../shared/types';

type Tab = 'scoreboard' | 'assignment' | 'multistep';

export default function Intelligence() {
  const [tab, setTab] = useState<Tab>('scoreboard');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'scoreboard', label: 'Agent Scoreboard' },
    { key: 'assignment', label: 'Smart Assignment' },
    { key: 'multistep', label: 'Multi-Step Runner' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Intelligence</h1>
      <div className="flex gap-1 rounded-lg bg-slate-800 p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'scoreboard' && <ScoreboardSection />}
      {tab === 'assignment' && <AssignmentSection />}
      {tab === 'multistep' && <MultiStepSection />}
    </div>
  );
}

/* ─── Agent Scoreboard ─── */

type SortKey = 'agent_name' | 'role' | 'total_tasks' | 'success_rate' | 'total_cost' | 'avg_cost_per_task';
type SortDir = 'asc' | 'desc';

function ScoreboardSection() {
  const { data: scores, loading, error } = useFetch<AgentScore[]>('/api/intelligence/scores');
  const [sortKey, setSortKey] = useState<SortKey>('success_rate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = scores
    ? [...scores].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (typeof av === 'string' && typeof bv === 'string') {
          return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        }
        return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
      })
    : [];

  function rateColor(rate: number) {
    if (rate > 80) return 'bg-green-500';
    if (rate > 50) return 'bg-amber-500';
    return 'bg-red-500';
  }

  function rateTextColor(rate: number) {
    if (rate > 80) return 'text-green-400';
    if (rate > 50) return 'text-amber-400';
    return 'text-red-400';
  }

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading scores...</div>;
  if (error) return <div className="text-red-400 py-8 text-center">Error: {error}</div>;

  const SortHeader = ({ label, field }: { label: string; field: SortKey }) => (
    <th
      onClick={() => handleSort(field)}
      className="cursor-pointer px-4 py-3 text-left font-medium text-slate-400 hover:text-slate-200 select-none"
    >
      {label} {sortKey === field ? (sortDir === 'asc' ? ' \u25B2' : ' \u25BC') : ''}
    </th>
  );

  return (
    <div>
      {!sorted.length ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800 py-12 text-center text-slate-500">No agent scores available.</div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/80">
                <SortHeader label="Agent" field="agent_name" />
                <SortHeader label="Role" field="role" />
                <SortHeader label="Tasks" field="total_tasks" />
                <SortHeader label="Success Rate" field="success_rate" />
                <SortHeader label="Total Cost" field="total_cost" />
                <SortHeader label="Avg Cost" field="avg_cost_per_task" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {sorted.map((s) => (
                <tr key={s.agent_id} className="bg-slate-800/40 transition-colors hover:bg-slate-800/70">
                  <td className="px-4 py-2.5 font-medium text-slate-100">{s.agent_name}</td>
                  <td className="px-4 py-2.5 text-slate-300">{s.role}</td>
                  <td className="px-4 py-2.5 text-slate-300">{s.total_tasks}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-20 rounded-full bg-slate-700">
                        <div className={`h-2 rounded-full ${rateColor(s.success_rate)}`} style={{ width: `${Math.min(s.success_rate, 100)}%` }} />
                      </div>
                      <span className={`text-xs font-medium ${rateTextColor(s.success_rate)}`}>{s.success_rate.toFixed(0)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-slate-300">${s.total_cost.toFixed(4)}</td>
                  <td className="px-4 py-2.5 text-slate-300">${s.avg_cost_per_task.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Smart Assignment ─── */

function AssignmentSection() {
  const { data: tickets } = useFetch<Ticket[]>('/api/tickets');
  const [selectedTicket, setSelectedTicket] = useState('');
  const [preferredRole, setPreferredRole] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ agent_name: string; agent_id: number; score: number } | null>(null);
  const [assignError, setAssignError] = useState('');

  const unassigned = tickets?.filter((t) => !t.agent_id && t.status !== 'done' && t.status !== 'failed');

  async function handleAssign() {
    if (!selectedTicket) return;
    setSubmitting(true);
    setResult(null);
    setAssignError('');
    try {
      const res = await fetchApi<{ agent_name: string; agent_id: number; score: number }>(
        '/api/intelligence/auto-assign',
        {
          method: 'POST',
          body: JSON.stringify({
            ticket_id: Number(selectedTicket),
            preferred_role: preferredRole.trim() || undefined,
          }),
        },
      );
      setResult(res);
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Failed to auto-assign');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Unassigned Ticket</label>
            <select
              value={selectedTicket}
              onChange={(e) => { setSelectedTicket(e.target.value); setResult(null); }}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select ticket...</option>
              {unassigned?.map((t) => <option key={t.id} value={t.id}>#{t.id} - {t.title}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Preferred Role (optional)</label>
            <input
              type="text"
              value={preferredRole}
              onChange={(e) => setPreferredRole(e.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g. developer, reviewer"
            />
          </div>
        </div>
        <button
          onClick={handleAssign}
          disabled={!selectedTicket || submitting}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {submitting ? 'Assigning...' : 'Auto-Assign'}
        </button>

        {result && (
          <div className="rounded-md border border-green-500/30 bg-green-500/10 p-4">
            <h4 className="font-semibold text-green-400">Assignment Result</h4>
            <p className="mt-1 text-sm text-slate-300">
              Agent <span className="font-semibold text-slate-100">{result.agent_name}</span> (ID: {result.agent_id}) was assigned with a score of{' '}
              <span className="font-semibold text-indigo-400">{result.score.toFixed(2)}</span>.
            </p>
          </div>
        )}

        {assignError && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{assignError}</div>
        )}
      </div>
    </div>
  );
}

/* ─── Multi-Step Runner ─── */

interface StepResult {
  step: number;
  output: string;
  agent_name?: string;
  status?: string;
}

function MultiStepSection() {
  const { data: tickets } = useFetch<Ticket[]>('/api/tickets');
  const [selectedTicket, setSelectedTicket] = useState('');
  const [maxSteps, setMaxSteps] = useState(5);
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [runError, setRunError] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleExpand(step: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(step) ? next.delete(step) : next.add(step);
      return next;
    });
  }

  async function handleRun() {
    if (!selectedTicket) return;
    setRunning(true);
    setSteps([]);
    setRunError('');
    try {
      const result = await fetchApi<{ steps: StepResult[] }>(
        '/api/intelligence/multi-step',
        {
          method: 'POST',
          body: JSON.stringify({
            ticket_id: Number(selectedTicket),
            max_steps: maxSteps,
          }),
        },
      );
      setSteps(result.steps || []);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Failed to run multi-step');
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-5 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Select Ticket</label>
            <select
              value={selectedTicket}
              onChange={(e) => { setSelectedTicket(e.target.value); setSteps([]); }}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Select ticket...</option>
              {tickets?.map((t) => <option key={t.id} value={t.id}>#{t.id} - {t.title}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Max Steps</label>
            <input
              type="number"
              min={1}
              max={20}
              value={maxSteps}
              onChange={(e) => setMaxSteps(Number(e.target.value))}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <button
          onClick={handleRun}
          disabled={!selectedTicket || running}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {running ? 'Running...' : 'Run Multi-Step'}
        </button>

        {running && (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            Processing steps...
          </div>
        )}

        {runError && (
          <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{runError}</div>
        )}
      </div>

      {steps.length > 0 && (
        <div className="space-y-3">
          {steps.map((s) => (
            <div key={s.step} className="rounded-lg border border-slate-700 bg-slate-800 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-indigo-600/20 px-2 py-0.5 text-xs font-semibold text-indigo-400">Step {s.step}</span>
                {s.agent_name && <span className="text-xs text-slate-500">{s.agent_name}</span>}
                {s.status && (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    s.status === 'done' ? 'bg-green-500/20 text-green-400' : s.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>{s.status}</span>
                )}
                <button onClick={() => toggleExpand(s.step)} className="ml-auto text-xs text-indigo-400 hover:text-indigo-300">
                  {expanded.has(s.step) ? 'Collapse' : 'Expand'}
                </button>
              </div>
              {expanded.has(s.step) && (
                <pre className="max-h-48 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-300">{s.output}</pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
