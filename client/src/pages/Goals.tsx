import { useState } from 'react';
import { Plus, Target, X } from 'lucide-react';
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
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Goals</h1>
          {goals && goals.length > 0 && (
            <span className="inline-flex items-center rounded-full bg-indigo-600/20 px-2.5 py-0.5 text-xs font-medium text-indigo-400 ring-1 ring-inset ring-indigo-500/30">
              {goals.length}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" />
              Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              New Goal
            </>
          )}
        </button>
      </div>

      {/* Create goal form panel */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
            <h2 className="text-lg font-semibold text-white">Create a New Goal</h2>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter goal title..."
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-300">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the goal..."
              rows={3}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end border-t border-slate-700/50 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Goal'}
            </button>
          </div>
        </form>
      )}

      {/* Goal grid */}
      {goals && goals.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-700/50">
            <Target className="h-6 w-6 text-slate-500" />
          </div>
          <h3 className="text-sm font-medium text-white">No goals defined yet</h3>
          <p className="mt-1 text-sm text-slate-500">
            Create your first goal to start orchestrating your agents.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            New Goal
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
          {goals?.map((goal) => (
            <div key={goal.id} className="relative">
              {decomposing === goal.id && (
                <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-slate-900/70">
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
