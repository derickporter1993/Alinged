import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchApi } from '../api';
import { Timer, Clock, Zap, Play, Power, Plus, Calendar } from 'lucide-react';
import type { Schedule, WorkflowTrigger, Goal, Agent } from '../../shared/types';

type Tab = 'schedules' | 'triggers' | 'autopilot';

export default function Automation() {
  const [tab, setTab] = useState<Tab>('schedules');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'schedules', label: 'Schedules' },
    { key: 'triggers', label: 'Workflow Triggers' },
    { key: 'autopilot', label: 'Autopilot' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-100">
        <Timer className="h-7 w-7 text-indigo-400" />
        Automation
      </h1>
      <div className="flex gap-1 rounded-xl bg-slate-800/50 p-1 border border-slate-700/50">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
              tab === t.key
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'schedules' && <SchedulesSection />}
      {tab === 'triggers' && <TriggersSection />}
      {tab === 'autopilot' && <AutopilotSection />}
    </div>
  );
}

/* ─── Schedules ─── */

function SchedulesSection() {
  const { data: schedules, loading, error, refetch } = useFetch<Schedule[]>('/api/automation/schedules');
  const { data: goals } = useFetch<Goal[]>('/api/goals');
  const { data: agents } = useFetch<Agent[]>('/api/agents');

  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    cron_expression: '',
    goal_id: '',
    agent_id: '',
    priority: '3',
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.cron_expression.trim()) return;
    setSubmitting(true);
    try {
      await fetchApi('/api/automation/schedules', {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          cron_expression: form.cron_expression.trim(),
          goal_id: form.goal_id ? Number(form.goal_id) : null,
          agent_id: form.agent_id ? Number(form.agent_id) : null,
          priority: Number(form.priority),
        }),
      });
      setForm({ title: '', description: '', cron_expression: '', goal_id: '', agent_id: '', priority: '3' });
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error('Failed to create schedule:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: number, enabled: number) {
    try {
      await fetchApi(`/api/automation/schedules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: enabled ? 0 : 1 }),
      });
      refetch();
    } catch (err) {
      console.error('Failed to toggle schedule:', err);
    }
  }

  async function handleTrigger(id: number) {
    try {
      await fetchApi(`/api/automation/schedules/${id}/trigger`, { method: 'POST' });
      refetch();
    } catch (err) {
      console.error('Failed to trigger schedule:', err);
    }
  }

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading schedules...</div>;
  if (error) return <div className="text-red-400 py-8 text-center">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30">
          {showForm ? 'Cancel' : <><Plus className="h-4 w-4" /> New Schedule</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-lg shadow-black/20 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Title</label>
              <input type="text" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Schedule title" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Cron Expression</label>
              <input type="text" value={form.cron_expression} onChange={(e) => setForm((p) => ({ ...p, cron_expression: e.target.value }))} required className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="0 9 * * 1" />
              <p className="mt-1 text-xs text-slate-500">e.g. &quot;0 9 * * 1&quot; = Every Monday at 9am</p>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Description</label>
            <input type="text" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Optional description" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Goal</label>
              <select value={form.goal_id} onChange={(e) => setForm((p) => ({ ...p, goal_id: e.target.value }))} className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">None</option>
                {goals?.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Agent</label>
              <select value={form.agent_id} onChange={(e) => setForm((p) => ({ ...p, agent_id: e.target.value }))} className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">None</option>
                {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Priority</label>
              <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="1">1 - Highest</option>
                <option value="2">2 - High</option>
                <option value="3">3 - Medium</option>
                <option value="4">4 - Low</option>
                <option value="5">5 - Lowest</option>
              </select>
            </div>
          </div>
          <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Schedule'}
          </button>
        </form>
      )}

      {!schedules || schedules.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center shadow-lg shadow-black/20 text-slate-500">No schedules yet.</div>
      ) : (
        <div className="space-y-3">
          {schedules.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 shadow-lg shadow-black/20 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-400 shrink-0" />
                    <h3 className="font-semibold text-slate-100 truncate">{s.title}</h3>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/50 text-slate-400'}`}>
                      {s.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {s.description && <p className="mt-1 text-sm text-slate-400">{s.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span className="font-mono bg-slate-900/50 border border-slate-700/50 rounded-lg px-2 py-0.5">{s.cron_expression}</span>
                    {s.agent_name && <span>Agent: {s.agent_name}</span>}
                    {s.goal_title && <span>Goal: {s.goal_title}</span>}
                    {s.next_run && <span><Clock className="inline h-3 w-3 mr-0.5" />Next: {new Date(s.next_run).toLocaleString()}</span>}
                    {s.last_run && <span>Last: {new Date(s.last_run).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleTrigger(s.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:bg-emerald-500">
                    <Play className="h-3 w-3" /> Trigger Now
                  </button>
                  <button
                    onClick={() => handleToggle(s.id, s.enabled)}
                    className={`inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-white transition-all duration-200 ${s.enabled ? 'bg-slate-600 hover:bg-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'}`}
                  >
                    <Power className="h-3 w-3" /> {s.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Workflow Triggers ─── */

const TRIGGER_EVENTS = ['ticket_done', 'ticket_failed', 'ticket_review', 'budget_alert'] as const;
const ACTION_TYPES = ['create_ticket', 'notify', 'assign_agent'] as const;

function TriggersSection() {
  const { data: triggers, loading, error, refetch } = useFetch<WorkflowTrigger[]>('/api/automation/triggers');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    trigger_event: 'ticket_done' as string,
    condition_config: '{}',
    action_type: 'create_ticket' as string,
    action_config: '{}',
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      const actionPayload = JSON.parse(form.action_config);
      await fetchApi('/api/automation/triggers', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          trigger_event: form.trigger_event,
          condition_config: form.condition_config.trim() || null,
          action_config: JSON.stringify({ type: form.action_type, ...actionPayload }),
        }),
      });
      setForm({ name: '', trigger_event: 'ticket_done', condition_config: '{}', action_type: 'create_ticket', action_config: '{}' });
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error('Failed to create trigger:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: number, enabled: number) {
    try {
      await fetchApi(`/api/automation/triggers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: enabled ? 0 : 1 }),
      });
      refetch();
    } catch (err) {
      console.error('Failed to toggle trigger:', err);
    }
  }

  const eventColors: Record<string, string> = {
    ticket_done: 'bg-green-500/20 text-green-400',
    ticket_failed: 'bg-red-500/20 text-red-400',
    ticket_review: 'bg-amber-500/20 text-amber-400',
    budget_alert: 'bg-pink-500/20 text-pink-400',
  };

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading triggers...</div>;
  if (error) return <div className="text-red-400 py-8 text-center">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30">
          {showForm ? 'Cancel' : <><Plus className="h-4 w-4" /> New Trigger</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-lg shadow-black/20 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="Trigger name" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Trigger Event</label>
              <select value={form.trigger_event} onChange={(e) => setForm((p) => ({ ...p, trigger_event: e.target.value }))} className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                {TRIGGER_EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Condition (JSON)</label>
            <textarea value={form.condition_config} onChange={(e) => setForm((p) => ({ ...p, condition_config: e.target.value }))} rows={2} className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder='{"priority": 1}' />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Action Type</label>
              <select value={form.action_type} onChange={(e) => setForm((p) => ({ ...p, action_type: e.target.value }))} className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                {ACTION_TYPES.map((at) => <option key={at} value={at}>{at}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Action Config (JSON)</label>
              <textarea value={form.action_config} onChange={(e) => setForm((p) => ({ ...p, action_config: e.target.value }))} rows={2} className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder='{"title": "Follow-up task"}' />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Trigger'}
          </button>
        </form>
      )}

      {!triggers || triggers.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center shadow-lg shadow-black/20 text-slate-500">No workflow triggers yet.</div>
      ) : (
        <div className="space-y-3">
          {triggers.map((t) => {
            let actionPreview = '';
            try { const a = JSON.parse(t.action_config); actionPreview = a.type || 'unknown'; } catch { actionPreview = 'invalid'; }
            let condPreview = '';
            try { if (t.condition_config) { condPreview = t.condition_config.length > 60 ? t.condition_config.slice(0, 60) + '...' : t.condition_config; } } catch { /* ignore */ }
            return (
              <div key={t.id} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 shadow-lg shadow-black/20 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-indigo-400 shrink-0" />
                      <h3 className="font-semibold text-slate-100">{t.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${eventColors[t.trigger_event] || 'bg-slate-600/50 text-slate-400'}`}>
                        {t.trigger_event}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/50 text-slate-400'}`}>
                        {t.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      {condPreview && <span>Condition: <span className="font-mono">{condPreview}</span></span>}
                      <span>Action: <span className="font-mono">{actionPreview}</span></span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(t.id, t.enabled)}
                    className={`inline-flex items-center gap-1 shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-white transition-all duration-200 ${t.enabled ? 'bg-slate-600 hover:bg-slate-500' : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'}`}
                  >
                    <Power className="h-3 w-3" /> {t.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Autopilot ─── */

function AutopilotSection() {
  const { data: goals, loading, error, refetch } = useFetch<Goal[]>('/api/goals');

  async function handleToggle(id: number, current: number) {
    try {
      await fetchApi(`/api/goals/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ autopilot: current ? 0 : 1 }),
      });
      refetch();
    } catch (err) {
      console.error('Failed to toggle autopilot:', err);
    }
  }

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading goals...</div>;
  if (error) return <div className="text-red-400 py-8 text-center">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-600/10 p-4 shadow-lg shadow-black/20 backdrop-blur-sm">
        <h3 className="flex items-center gap-2 font-semibold text-indigo-300"><Zap className="h-4 w-4" /> What is Autopilot?</h3>
        <p className="mt-1 text-sm text-slate-400">
          When autopilot is enabled for a goal, the system will automatically create tickets, assign agents,
          and execute tasks without requiring manual approval. Agents will autonomously break down the goal
          into sub-tasks, pick the best-suited agent for each, and run them in sequence until the goal is complete.
        </p>
      </div>

      {!goals || goals.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center shadow-lg shadow-black/20 text-slate-500">No goals yet. Create goals first.</div>
      ) : (
        <div className="space-y-3">
          {goals.map((g) => (
            <div key={g.id} className="flex items-center justify-between rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 shadow-lg shadow-black/20 backdrop-blur-sm">
              <div>
                <h3 className="font-semibold text-slate-100">{g.title}</h3>
                <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${
                    g.status === 'active' ? 'bg-green-500/20 text-green-400' :
                    g.status === 'completed' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-600/50 text-slate-400'
                  }`}>{g.status}</span>
                  {g.description && <span className="truncate max-w-xs">{g.description}</span>}
                </div>
              </div>
              <button
                onClick={() => handleToggle(g.id, g.autopilot)}
                className={`inline-flex items-center gap-1.5 shrink-0 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-all duration-200 ${
                  g.autopilot
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20'
                    : 'bg-slate-600 hover:bg-slate-500'
                }`}
              >
                <Power className="h-4 w-4" /> {g.autopilot ? 'Autopilot ON' : 'Autopilot OFF'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
