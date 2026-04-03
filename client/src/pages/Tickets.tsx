import { useState, useCallback } from 'react';
import { useFetch } from '../hooks/useFetch';
import { useSocket } from '../hooks/useSocket';
import { fetchApi } from '../api';
import TicketBoard from '../components/TicketBoard';
import type { Ticket, Goal, Agent } from '../../shared/types';

export default function Tickets() {
  const { data: tickets, loading, error, refetch } = useFetch<Ticket[]>('/api/tickets');
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

  async function handleUpdateTicket(ticketId: number, data: Partial<Ticket>) {
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
        <div className="text-slate-400">Loading tickets...</div>
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
        <h1 className="text-2xl font-bold text-slate-100">Tickets</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          {showForm ? 'Cancel' : 'New Ticket'}
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-slate-700 bg-slate-800 p-5 space-y-4"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Title
              </label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => updateField('title', e.target.value)}
                placeholder="Ticket title..."
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Describe the ticket..."
                rows={3}
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Goal
              </label>
              <select
                value={form.goal_id}
                onChange={(e) => updateField('goal_id', e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Assign Agent
              </label>
              <select
                value={form.agent_id}
                onChange={(e) => updateField('agent_id', e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) => updateField('priority', e.target.value)}
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="0">0 - Low</option>
                <option value="1">1 - Medium</option>
                <option value="2">2 - High</option>
                <option value="3">3 - Critical</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Ticket'}
          </button>
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
