import { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchApi } from '../api';
import { MessageSquare, GitPullRequest, BookOpen, Send, Search, Plus, ArrowRight, Edit3, Trash2 } from 'lucide-react';
import type {
  Agent,
  AgentMessage,
  ReviewChain,
  ReviewChainStep,
  KnowledgeBaseEntry,
  Ticket,
} from '../../shared/types';

type Tab = 'messages' | 'reviews' | 'knowledge';

export default function Collaboration() {
  const [tab, setTab] = useState<Tab>('messages');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'messages', label: 'Agent Messages' },
    { key: 'reviews', label: 'Review Chains' },
    { key: 'knowledge', label: 'Knowledge Base' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-3 text-2xl font-bold text-slate-100">
        <MessageSquare className="h-7 w-7 text-indigo-400" />
        Collaboration
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
      {tab === 'messages' && <MessagesSection />}
      {tab === 'reviews' && <ReviewChainsSection />}
      {tab === 'knowledge' && <KnowledgeSection />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Agent Messages                                                     */
/* ------------------------------------------------------------------ */

function MessagesSection() {
  const { data: messages, loading, error, refetch } = useFetch<AgentMessage[]>('/api/collaboration/messages');
  const { data: agents } = useFetch<Agent[]>('/api/agents');
  const { data: tickets } = useFetch<Ticket[]>('/api/tickets');

  const [filterAgent, setFilterAgent] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [fromAgent, setFromAgent] = useState('');
  const [toAgent, setToAgent] = useState('');
  const [ticketId, setTicketId] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!fromAgent || !toAgent || !content.trim()) return;
    setSubmitting(true);
    try {
      await fetchApi('/api/collaboration/messages', {
        method: 'POST',
        body: JSON.stringify({
          from_agent_id: Number(fromAgent),
          to_agent_id: Number(toAgent),
          ticket_id: ticketId ? Number(ticketId) : null,
          content: content.trim(),
        }),
      });
      setContent('');
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = messages?.filter((m) =>
    filterAgent
      ? m.from_agent_id === Number(filterAgent) || m.to_agent_id === Number(filterAgent)
      : true,
  );

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading messages...</div>;
  if (error) return <div className="text-red-400 py-8 text-center">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <select
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 pl-10 pr-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="">All Agents</option>
            {agents?.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30"
        >
          {showForm ? 'Cancel' : <><Plus className="h-4 w-4" /> New Message</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSend} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-lg shadow-black/20 space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">From Agent</label>
              <select value={fromAgent} onChange={(e) => setFromAgent(e.target.value)} required className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">Select...</option>
                {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">To Agent</label>
              <select value={toAgent} onChange={(e) => setToAgent(e.target.value)} required className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">Select...</option>
                {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Ticket (optional)</label>
              <select value={ticketId} onChange={(e) => setTicketId(e.target.value)} className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">None</option>
                {tickets?.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Content</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} required placeholder="Type message..." className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30 disabled:opacity-50">
            <Send className="h-4 w-4" />
            {submitting ? 'Sending...' : 'Send Message'}
          </button>
        </form>
      )}

      <div className="space-y-3">
        {filtered && filtered.length === 0 ? (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center shadow-lg shadow-black/20 text-slate-500">No messages yet.</div>
        ) : (
          filtered?.map((msg) => {
            const isLeft = msg.from_agent_id <= (msg.to_agent_id ?? 0);
            return (
              <div key={msg.id} className={`flex ${isLeft ? 'justify-start' : 'justify-end'}`}>
                <div className={`max-w-lg rounded-xl p-4 shadow-lg shadow-black/20 ${isLeft ? 'bg-slate-800/50 border border-slate-700/50' : 'bg-indigo-600/20 border border-indigo-500/30'}`}>
                  <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold text-indigo-400">{msg.from_agent_name ?? `Agent #${msg.from_agent_id}`}</span>
                    <ArrowRight className="h-3 w-3 text-slate-500" />
                    <span className="font-semibold text-slate-300">{msg.to_agent_name ?? `Agent #${msg.to_agent_id}`}</span>
                  </div>
                  <p className="text-sm text-slate-100 whitespace-pre-wrap">{msg.content}</p>
                  <div className="mt-2 text-xs text-slate-500">{new Date(msg.created_at).toLocaleString()}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Review Chains                                                      */
/* ------------------------------------------------------------------ */

function ReviewChainsSection() {
  const { data: chains, loading, error, refetch } = useFetch<ReviewChain[]>('/api/collaboration/review-chains');
  const { data: agents } = useFetch<Agent[]>('/api/agents');

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [steps, setSteps] = useState<ReviewChainStep[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [runTicketId, setRunTicketId] = useState<Record<number, string>>({});
  const [running, setRunning] = useState<number | null>(null);

  function addStep() {
    setSteps([...steps, { agent_id: agents?.[0]?.id ?? 0, role: '', order: steps.length + 1 }]);
  }

  function updateStep(idx: number, field: keyof ReviewChainStep, value: string | number) {
    const updated = [...steps];
    updated[idx] = { ...updated[idx], [field]: field === 'agent_id' || field === 'order' ? Number(value) : value };
    setSteps(updated);
  }

  function removeStep(idx: number) {
    setSteps(steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || steps.length === 0) return;
    setSubmitting(true);
    try {
      await fetchApi('/api/collaboration/review-chains', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), steps: JSON.stringify(steps) }),
      });
      setName('');
      setSteps([]);
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error('Failed to create chain:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRun(chainId: number) {
    const tid = runTicketId[chainId];
    if (!tid) return;
    setRunning(chainId);
    try {
      await fetchApi(`/api/collaboration/review-chains/${chainId}/run`, {
        method: 'POST',
        body: JSON.stringify({ ticket_id: Number(tid) }),
      });
    } catch (err) {
      console.error('Failed to run chain:', err);
    } finally {
      setRunning(null);
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetchApi(`/api/collaboration/review-chains/${id}`, { method: 'DELETE' });
      refetch();
    } catch (err) {
      console.error('Failed to delete chain:', err);
    }
  }

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading review chains...</div>;
  if (error) return <div className="text-red-400 py-8 text-center">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <button onClick={() => setShowForm(!showForm)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30">
        {showForm ? 'Cancel' : <><Plus className="h-4 w-4" /> New Review Chain</>}
      </button>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-lg shadow-black/20 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Chain Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Code Review Pipeline" className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div className="space-y-2">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Steps</label>
            {steps.map((step, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-900/50 border border-slate-700/50 p-2">
                <span className="text-xs text-slate-400 w-6 text-center">{step.order}.</span>
                <select value={step.agent_id} onChange={(e) => updateStep(idx, 'agent_id', e.target.value)} className="rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                  {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <input type="text" value={step.role} onChange={(e) => updateStep(idx, 'role', e.target.value)} placeholder="Role (e.g. reviewer)" className="flex-1 min-w-[120px] rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
                <button type="button" onClick={() => removeStep(idx)} className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 text-xs"><Trash2 className="h-3 w-3" /> Remove</button>
              </div>
            ))}
            <button type="button" onClick={addStep} className="inline-flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"><Plus className="h-4 w-4" /> Add Step</button>
          </div>
          <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Chain'}
          </button>
        </form>
      )}

      {chains && chains.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center shadow-lg shadow-black/20 text-slate-500">No review chains yet.</div>
      ) : (
        <div className="space-y-4">
          {chains?.map((chain) => {
            const parsedSteps: ReviewChainStep[] = JSON.parse(chain.steps || '[]');
            return (
              <div key={chain.id} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 shadow-lg shadow-black/20 backdrop-blur-sm space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-slate-100">{chain.name}</h3>
                  <button onClick={() => handleDelete(chain.id)} className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><Trash2 className="h-3 w-3" /> Delete</button>
                </div>
                {/* Pipeline visualization */}
                <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
                  {parsedSteps.sort((a, b) => a.order - b.order).map((step, idx) => {
                    const agent = agents?.find((a) => a.id === step.agent_id);
                    return (
                      <div key={idx} className="flex items-center gap-2">
                        <div className="rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-3 py-1.5 text-xs">
                          <span className="font-semibold text-indigo-400">{agent?.name ?? `Agent #${step.agent_id}`}</span>
                          <span className="text-slate-400 ml-1">({step.role})</span>
                        </div>
                        {idx < parsedSteps.length - 1 && <ArrowRight className="h-4 w-4 text-slate-500" />}
                      </div>
                    );
                  })}
                </div>
                {/* Run chain */}
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Ticket ID"
                    value={runTicketId[chain.id] ?? ''}
                    onChange={(e) => setRunTicketId({ ...runTicketId, [chain.id]: e.target.value })}
                    className="w-32 rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <button
                    onClick={() => handleRun(chain.id)}
                    disabled={running === chain.id}
                    className="rounded-lg bg-green-600 px-3 py-2.5 text-sm font-medium text-white shadow-lg shadow-green-500/20 transition-all duration-200 hover:bg-green-500 disabled:opacity-50"
                  >
                    {running === chain.id ? 'Running...' : 'Run Chain'}
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

/* ------------------------------------------------------------------ */
/*  Knowledge Base                                                     */
/* ------------------------------------------------------------------ */

function KnowledgeSection() {
  const { data: entries, loading, error, refetch } = useFetch<KnowledgeBaseEntry[]>('/api/collaboration/knowledge');
  const { data: agents } = useFetch<Agent[]>('/api/agents');

  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [authorAgent, setAuthorAgent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = entries?.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) ||
      e.content.toLowerCase().includes(search.toLowerCase()) ||
      (e.tags && e.tags.toLowerCase().includes(search.toLowerCase())),
  );

  function startEdit(entry: KnowledgeBaseEntry) {
    setEditingId(entry.id);
    setTitle(entry.title);
    setContent(entry.content);
    setTags(entry.tags ?? '');
    setAuthorAgent(entry.author_agent_id?.toString() ?? '');
    setShowForm(true);
  }

  function resetForm() {
    setEditingId(null);
    setTitle('');
    setContent('');
    setTags('');
    setAuthorAgent('');
    setShowForm(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    const payload = {
      title: title.trim(),
      content: content.trim(),
      tags: tags.trim() || null,
      author_agent_id: authorAgent ? Number(authorAgent) : null,
    };
    try {
      if (editingId) {
        await fetchApi(`/api/collaboration/knowledge/${editingId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await fetchApi('/api/collaboration/knowledge', { method: 'POST', body: JSON.stringify(payload) });
      }
      resetForm();
      refetch();
    } catch (err) {
      console.error('Failed to save entry:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetchApi(`/api/collaboration/knowledge/${id}`, { method: 'DELETE' });
      refetch();
    } catch (err) {
      console.error('Failed to delete entry:', err);
    }
  }

  const tagColors = ['bg-indigo-500/20 text-indigo-400', 'bg-green-500/20 text-green-400', 'bg-amber-500/20 text-amber-400', 'bg-pink-500/20 text-pink-400', 'bg-cyan-500/20 text-cyan-400'];

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading knowledge base...</div>;
  if (error) return <div className="text-red-400 py-8 text-center">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search entries..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm); }} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30">
          {showForm && !editingId ? 'Cancel' : <><Plus className="h-4 w-4" /> New Entry</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-lg shadow-black/20 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Entry title" className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Content</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} required rows={5} placeholder="Content..." className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Tags (comma-separated)</label>
              <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. react, api, deployment" className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Author Agent (optional)</label>
              <select value={authorAgent} onChange={(e) => setAuthorAgent(e.target.value)} className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">None</option>
                {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30 disabled:opacity-50">
              {submitting ? 'Saving...' : editingId ? 'Update Entry' : 'Create Entry'}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="rounded-lg bg-slate-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-500 transition-all duration-200">Cancel Edit</button>
            )}
          </div>
        </form>
      )}

      {filtered && filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center shadow-lg shadow-black/20 text-slate-500">No entries found.</div>
      ) : (
        <div className="space-y-3">
          {filtered?.map((entry) => {
            const entryTags = entry.tags ? entry.tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
            return (
              <div key={entry.id} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-5 shadow-lg shadow-black/20 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-slate-100">{entry.title}</h3>
                    <p className="mt-1 text-sm text-slate-300 whitespace-pre-wrap">{entry.content}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {entryTags.map((tag, i) => (
                        <span key={i} className={`rounded-full px-2 py-0.5 text-xs font-medium ${tagColors[i % tagColors.length]}`}>{tag}</span>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-slate-500">
                      {entry.author_name && <span>By {entry.author_name} &middot; </span>}
                      {new Date(entry.updated_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => startEdit(entry)} className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"><Edit3 className="h-3 w-3" /> Edit</button>
                    <button onClick={() => handleDelete(entry.id)} className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300"><Trash2 className="h-3 w-3" /> Delete</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
