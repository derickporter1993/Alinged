import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchApi } from '../api';
import type { ConversationLog, CostForecast, TicketDependency, Agent, Ticket } from '../../shared/types';

type Tab = 'logs' | 'forecast' | 'dependencies';

export default function Observability() {
  const [tab, setTab] = useState<Tab>('logs');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'logs', label: 'Conversation Logs' },
    { key: 'forecast', label: 'Cost Forecast' },
    { key: 'dependencies', label: 'Dependency Graph' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Observability</h1>
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
      {tab === 'logs' && <ConversationLogsSection />}
      {tab === 'forecast' && <CostForecastSection />}
      {tab === 'dependencies' && <DependencyGraphSection />}
    </div>
  );
}

/* ─── Conversation Logs ─── */

function ConversationLogsSection() {
  const { data: agents } = useFetch<Agent[]>('/api/agents');
  const { data: tickets } = useFetch<Ticket[]>('/api/tickets');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterTicket, setFilterTicket] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 50;

  const queryParams = new URLSearchParams();
  if (filterAgent) queryParams.set('agent_id', filterAgent);
  if (filterTicket) queryParams.set('ticket_id', filterTicket);
  queryParams.set('page', String(page));
  queryParams.set('limit', String(perPage));

  const { data: logs, loading, error, refetch } = useFetch<ConversationLog[]>(
    `/api/conversation-logs?${queryParams.toString()}`,
  );

  async function handleClearOld() {
    if (!confirm('Clear conversation logs older than 30 days?')) return;
    try {
      await fetchApi('/api/conversation-logs/clear-old', { method: 'DELETE' });
      refetch();
    } catch (err) {
      console.error('Failed to clear old logs:', err);
    }
  }

  function roleStyle(role: string) {
    switch (role) {
      case 'system': return 'bg-slate-700/50 border-slate-600 text-slate-400';
      case 'user': return 'bg-blue-600/10 border-blue-500/30 text-blue-300';
      case 'assistant': return 'bg-green-600/10 border-green-500/30 text-green-300';
      default: return 'bg-slate-700/50 border-slate-600 text-slate-400';
    }
  }

  function roleBadge(role: string) {
    switch (role) {
      case 'system': return 'bg-slate-600/50 text-slate-400';
      case 'user': return 'bg-blue-500/20 text-blue-400';
      case 'assistant': return 'bg-green-500/20 text-green-400';
      default: return 'bg-slate-600/50 text-slate-400';
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Agent</label>
          <select
            value={filterAgent}
            onChange={(e) => { setFilterAgent(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Agents</option>
            {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Ticket</label>
          <select
            value={filterTicket}
            onChange={(e) => { setFilterTicket(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Tickets</option>
            {tickets?.map((t) => <option key={t.id} value={t.id}>#{t.id} - {t.title}</option>)}
          </select>
        </div>
        <button onClick={handleClearOld} className="rounded-md bg-red-600/80 px-3 py-2 text-sm font-medium text-white hover:bg-red-600">
          Clear Old Logs
        </button>
      </div>

      {loading && <div className="text-slate-400 py-8 text-center">Loading logs...</div>}
      {error && <div className="text-red-400 py-8 text-center">Error: {error}</div>}

      {!loading && logs && logs.length === 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 py-12 text-center text-slate-500">No conversation logs found.</div>
      )}

      {logs && logs.length > 0 && (
        <>
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className={`rounded-lg border p-3 ${roleStyle(log.role)}`}>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${roleBadge(log.role)}`}>{log.role}</span>
                  {log.agent_name && <span className="text-slate-500">{log.agent_name}</span>}
                  {log.ticket_id && <span className="text-slate-500">Ticket #{log.ticket_id}</span>}
                  <span className="text-slate-600">{log.tokens} tokens</span>
                  <span className="ml-auto text-slate-600">{new Date(log.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{log.content}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-slate-400">Page {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={logs.length < perPage}
              className="rounded-md bg-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-600 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Cost Forecast ─── */

function CostForecastSection() {
  const { data: forecast, loading, error } = useFetch<CostForecast>('/api/budget/forecast');

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading forecast...</div>;
  if (error) return <div className="text-red-400 py-8 text-center">Error: {error}</div>;
  if (!forecast) return <div className="text-slate-400 py-8 text-center">No forecast data available.</div>;

  const statCards = [
    { label: 'Daily Rate', value: `$${forecast.dailyRate.toFixed(2)}`, color: 'border-blue-500' },
    { label: 'Weekly Rate', value: `$${forecast.weeklyRate.toFixed(2)}`, color: 'border-indigo-500' },
    { label: 'Monthly Projection', value: `$${forecast.monthlyProjection.toFixed(2)}`, color: 'border-green-500' },
    { label: 'Days of Data', value: String(forecast.daysOfData), color: 'border-amber-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className={`rounded-lg border-l-4 ${card.color} bg-slate-800 p-4`}>
            <div className="text-sm text-slate-400">{card.label}</div>
            <div className="mt-1 text-2xl font-bold text-slate-100">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-indigo-500/30 bg-indigo-600/10 p-5">
        <h3 className="font-semibold text-indigo-300">Projection</h3>
        <p className="mt-2 text-slate-300">
          At current rates, you&apos;ll spend approximately{' '}
          <span className="text-xl font-bold text-indigo-400">${forecast.monthlyProjection.toFixed(2)}</span>{' '}
          this month.
        </p>
        {forecast.daysOfData < 7 && (
          <p className="mt-2 text-sm text-amber-400">
            Note: Only {forecast.daysOfData} day(s) of data available. Projections will be more accurate with more data.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Dependency Graph ─── */

function DependencyGraphSection() {
  const { data: deps, loading, error, refetch } = useFetch<TicketDependency[]>('/api/ticket-dependencies');
  const { data: tickets } = useFetch<Ticket[]>('/api/tickets');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ticket_id: '', depends_on_id: '' });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.ticket_id || !form.depends_on_id) return;
    if (form.ticket_id === form.depends_on_id) return;
    setSubmitting(true);
    try {
      await fetchApi('/api/ticket-dependencies', {
        method: 'POST',
        body: JSON.stringify({
          ticket_id: Number(form.ticket_id),
          depends_on_id: Number(form.depends_on_id),
        }),
      });
      setForm({ ticket_id: '', depends_on_id: '' });
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error('Failed to add dependency:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetchApi(`/api/ticket-dependencies/${id}`, { method: 'DELETE' });
      refetch();
    } catch (err) {
      console.error('Failed to delete dependency:', err);
    }
  }

  // Compute blocked tickets: those whose dependencies are not all "done"
  const blockedTicketIds = new Set<number>();
  if (deps && tickets) {
    const ticketStatusMap = new Map(tickets.map((t) => [t.id, t.status]));
    const depsByTicket = new Map<number, number[]>();
    for (const d of deps) {
      if (!depsByTicket.has(d.ticket_id)) depsByTicket.set(d.ticket_id, []);
      depsByTicket.get(d.ticket_id)!.push(d.depends_on_id);
    }
    for (const [ticketId, depIds] of depsByTicket) {
      const allDone = depIds.every((did) => ticketStatusMap.get(did) === 'done');
      if (!allDone) blockedTicketIds.add(ticketId);
    }
  }

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading dependencies...</div>;
  if (error) return <div className="text-red-400 py-8 text-center">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {blockedTicketIds.size > 0 && (
          <div className="text-sm text-red-400">
            {blockedTicketIds.size} blocked ticket(s)
          </div>
        )}
        <button onClick={() => setShowForm(!showForm)} className="ml-auto rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {showForm ? 'Cancel' : 'Add Dependency'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-slate-700 bg-slate-800 p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Ticket</label>
              <select value={form.ticket_id} onChange={(e) => setForm((p) => ({ ...p, ticket_id: e.target.value }))} required className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select ticket...</option>
                {tickets?.map((t) => <option key={t.id} value={t.id}>#{t.id} - {t.title}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Depends On</label>
              <select value={form.depends_on_id} onChange={(e) => setForm((p) => ({ ...p, depends_on_id: e.target.value }))} required className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select ticket...</option>
                {tickets?.map((t) => <option key={t.id} value={t.id}>#{t.id} - {t.title}</option>)}
              </select>
            </div>
          </div>
          <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            {submitting ? 'Adding...' : 'Add Dependency'}
          </button>
        </form>
      )}

      {!deps || deps.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800 py-12 text-center text-slate-500">No dependencies defined.</div>
      ) : (
        <div className="space-y-2">
          {deps.map((d) => {
            const isBlocked = blockedTicketIds.has(d.ticket_id);
            const depTicketStatus = tickets?.find((t) => t.id === d.depends_on_id)?.status;
            return (
              <div key={d.id} className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${isBlocked ? 'border-red-500/30 bg-red-600/5' : 'border-slate-700 bg-slate-800'}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={`font-medium text-sm ${isBlocked ? 'text-red-300' : 'text-slate-100'}`}>
                    {d.ticket_title || `Ticket #${d.ticket_id}`}
                  </span>
                  <span className="text-slate-500">&rarr; depends on &rarr;</span>
                  <span className="text-sm text-slate-300">
                    {d.depends_on_title || `Ticket #${d.depends_on_id}`}
                  </span>
                  {depTicketStatus && (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      depTicketStatus === 'done' ? 'bg-green-500/20 text-green-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>{depTicketStatus}</span>
                  )}
                  {isBlocked && (
                    <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">blocked</span>
                  )}
                </div>
                <button onClick={() => handleDelete(d.id)} className="shrink-0 text-xs text-red-400 hover:text-red-300">Delete</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
