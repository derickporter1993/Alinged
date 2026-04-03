import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchApi } from '../api';
import GoalCard from '../components/GoalCard';
import type { Goal } from '../../shared/types';

export default function Goals() {
  const { data: goals, loading, error, refetch } = useFetch<Goal[]>('/api/goals');
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [decomposing, setDecomposing] = useState<number | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await fetchApi('/api/goals', {
        method: 'POST',
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null }),
      });
      setTitle('');
      setDescription('');
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error('Failed to create goal:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecompose(goalId: number) {
    setDecomposing(goalId);
    try {
      await fetchApi(`/api/goals/${goalId}/decompose`, { method: 'POST' });
      refetch();
    } catch (err) {
      console.error('Failed to decompose goal:', err);
    } finally {
      setDecomposing(null);
    }
  }

  async function handleUpdate(goalId: number, data: Partial<Goal>) {
    try {
      await fetchApi(`/api/goals/${goalId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      refetch();
    } catch (err) {
      console.error('Failed to update goal:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-400">Loading goals...</div>
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
        <h1 className="text-2xl font-bold text-slate-100">Goals</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          {showForm ? 'Cancel' : 'New Goal'}
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-lg border border-slate-700 bg-slate-800 p-5 space-y-4"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter goal title..."
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the goal..."
              rows={3}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
          >
            {submitting ? 'Creating...' : 'Create Goal'}
          </button>
        </form>
      )}

      {/* Goal list */}
      {goals && goals.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800 py-12 text-center">
          <div className="text-slate-500">No goals yet. Create one to get started.</div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals?.map((goal) => (
            <div key={goal.id} className="relative">
              {decomposing === goal.id && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-slate-900/70">
                  <div className="text-sm text-indigo-400">Decomposing...</div>
                </div>
              )}
              <GoalCard
                goal={goal}
                onDecompose={handleDecompose}
                onUpdate={handleUpdate}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
