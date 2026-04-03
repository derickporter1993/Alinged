import { useState, useCallback } from 'react';
import { Plus, Ticket, X } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { useSocket } from '../hooks/useSocket';
import { fetchApi } from '../api';
import TicketBoard from '../components/TicketBoard';
import type { Ticket as TicketType, Goal, Agent } from '../../shared/types';

const priorities = [
  { value: '0', label: 'Low', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  { value: '1', label: 'Medium', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  { value: '2', label: 'High', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
  { value: '3', label: 'Critical', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
];

export default function Tickets() {
  const { data: tickets, loading, error, refetch } = useFetch<TicketType[]>('/api/tickets');
  const { data: goals } = useFetch<Goal[]>('/api/goals');
  const { data: agents } = useFetch<Agent[]>('/api/agents');

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    goal_id: '',
    agent_id: '',
    priority: '1',
  });

  const onTicketUpdated = useCallback(() => {
    refetch();
  }, [refetch]);

  useSocket('ticket:updated', onTicketUpdated);

  function updateField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      await fetchApi('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          goal_id: form.goal_id ? Number(form.goal_id) : null,
          agent_id: form.agent_id ? Number(form.agent_id) : null,
          priority: Number(form.priority),
        }),
      });
      setForm({ title: '', description: '', goal_id: '', agent_id: '', priority: '1' });
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error('Failed to create ticket:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateTicket(ticketId: number, data: Partial<TicketType>) {
    try {
      await fetchApi(`/api/tickets/${ticketId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      refetch();
    } catch (err) {
      console.error('Failed to update ticket:', err);
    }
  }

  async function handleRunTicket(ticketId: number) {
    try {
      await fetchApi(`/api/tickets/${ticketId}/run`, { method: 'POST' });
      refetch();
    } catch (err) {
      console.error('Failed to run ticket:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-500" />
          <span className="text-sm">Loading tickets...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-6 py-4 text-sm text-red-400">
          Error: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15">
            <Ticket className="h-5 w-5 text-indigo-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Tickets</h1>
          {tickets && tickets.length > 0 && (
            <span className="inline-flex h-6 items-center rounded-full bg-indigo-500/15 px-2.5 text-xs font-medium text-indigo-400">
              {tickets.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
            showForm
              ? 'border border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
              : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500'
          }`}
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              New Ticket
            </>
          )}
        </button>
      </div>

      {/* Create ticket form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6"
        >
          <div className="mb-5 flex items-center gap-2">
            <Plus className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Create New Ticket</h2>
          </div>

          <div className="space-y-5">
            {/* Title - full width */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Ticket title..."
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Description - full width */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe the ticket..."
                rows={3}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* 2-column grid for Goal and Agent */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Goal
                </label>
                <select
                  value={form.goal_id}
                  onChange={(e) => updateField('goal_id', e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">No goal</option>
                  {goals?.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-300">
                  Assign Agent
                </label>
                <select
                  value={form.agent_id}
                  onChange={(e) => updateField('agent_id', e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {agents
                    ?.filter((a) => a.status !== 'terminated')
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.role})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Priority chips */}
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-300">
                Priority
              </label>
              <div className="flex flex-wrap gap-2">
                {priorities.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => updateField('priority', p.value)}
                    className={`rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-all ${
                      form.priority === p.value
                        ? `${p.color} ring-1 ring-current`
                        : 'border-slate-700 bg-slate-800/50 text-slate-500 hover:border-slate-600 hover:text-slate-400'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Form actions */}
          <div className="mt-6 flex items-center gap-3 border-t border-slate-700/50 pt-5">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Ticket
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-400 transition-colors hover:text-slate-300"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Kanban board */}
      <TicketBoard
        tickets={tickets ?? []}
        onUpdateTicket={handleUpdateTicket}
        onRunTicket={handleRunTicket}
      />
    </div>
  );
}
