import { useState } from 'react';
import { ShieldCheck, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, RotateCcw, FileCheck } from 'lucide-react';
import { useFetch } from '../hooks/useFetch';
import { fetchApi } from '../api';
import type { Checkpoint, ValidationRule, TicketVersion, Agent, Ticket } from '../../shared/types';

type Tab = 'checkpoints' | 'validation' | 'versions';

export default function Quality() {
  const [tab, setTab] = useState<Tab>('checkpoints');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'checkpoints', label: 'Checkpoints' },
    { key: 'validation', label: 'Validation Rules' },
    { key: 'versions', label: 'Version History' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-100">
        <ShieldCheck className="h-7 w-7 text-indigo-400" />
        Quality
      </h1>
      <div className="flex gap-1 rounded-xl bg-slate-800/50 p-1 border border-slate-700/50">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 ${
              tab === t.key ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'checkpoints' && <CheckpointsSection />}
      {tab === 'validation' && <ValidationSection />}
      {tab === 'versions' && <VersionsSection />}
    </div>
  );
}

/* ─── Checkpoints ─── */

function CheckpointsSection() {
  const { data: checkpoints, loading, error, refetch } = useFetch<Checkpoint[]>('/api/quality/checkpoints');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [submitting, setSubmitting] = useState<number | null>(null);

  async function handleResolve(id: number, status: 'approved' | 'rejected') {
    setSubmitting(id);
    try {
      await fetchApi(`/api/quality/checkpoints/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status, reviewer_notes: notes[id]?.trim() || null }),
      });
      setNotes((p) => { const n = { ...p }; delete n[id]; return n; });
      refetch();
    } catch (err) {
      console.error('Failed to resolve checkpoint:', err);
    } finally {
      setSubmitting(null);
    }
  }

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const filtered = checkpoints?.filter((c) => !statusFilter || c.status === statusFilter);

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading checkpoints...</div>;
  if (error) return <div className="text-red-400 py-8 text-center">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['', 'pending', 'approved', 'rejected'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
              statusFilter === s ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {!filtered || filtered.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center shadow-lg shadow-black/20">
          <FileCheck className="mx-auto h-8 w-8 text-slate-600 mb-3" />
          <p className="text-slate-500">No checkpoints found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((cp) => {
            const statusColor = cp.status === 'approved' ? 'bg-green-500/20 text-green-400' : cp.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400';
            return (
              <div key={cp.id} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 shadow-lg shadow-black/20 backdrop-blur-sm space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>{cp.status}</span>
                  <span className="text-sm font-semibold text-slate-100">{cp.ticket_title || `Ticket #${cp.ticket_id}`}</span>
                  <span className="text-xs text-slate-500">by {cp.agent_name || `Agent #${cp.agent_id}`}</span>
                  <span className="ml-auto text-xs text-slate-500">{new Date(cp.created_at).toLocaleString()}</span>
                </div>

                {cp.output_preview && (
                  <div>
                    <button onClick={() => toggleExpand(cp.id)} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                      {expanded.has(cp.id) ? <><ChevronUp className="h-3 w-3" /> Collapse output</> : <><ChevronDown className="h-3 w-3" /> Expand output</>}
                    </button>
                    {expanded.has(cp.id) && (
                      <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-300">{cp.output_preview}</pre>
                    )}
                  </div>
                )}

                {cp.resolved_at && (
                  <div className="text-xs text-slate-500">Resolved: {new Date(cp.resolved_at).toLocaleString()}</div>
                )}

                {cp.reviewer_notes && cp.status !== 'pending' && (
                  <div className="text-xs text-slate-400">Notes: {cp.reviewer_notes}</div>
                )}

                {cp.status === 'pending' && (
                  <div className="flex flex-wrap items-end gap-2 pt-1">
                    <textarea
                      value={notes[cp.id] || ''}
                      onChange={(e) => setNotes((p) => ({ ...p, [cp.id]: e.target.value }))}
                      rows={1}
                      placeholder="Notes (optional)"
                      className="flex-1 min-w-[200px] rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    <button
                      onClick={() => handleResolve(cp.id, 'approved')}
                      disabled={submitting === cp.id}
                      className="flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2.5 text-xs font-medium text-white shadow-lg shadow-green-500/20 transition-all duration-200 hover:bg-green-500 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => handleResolve(cp.id, 'rejected')}
                      disabled={submitting === cp.id}
                      className="flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2.5 text-xs font-medium text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:bg-red-500 disabled:opacity-50"
                    >
                      <XCircle className="h-3.5 w-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Validation Rules ─── */

const RULE_TYPES: ValidationRule['rule_type'][] = ['regex', 'min_length', 'max_length', 'json_schema', 'contains', 'not_contains'];

function ValidationSection() {
  const { data: rules, loading, error, refetch } = useFetch<ValidationRule[]>('/api/quality/validation-rules');
  const { data: agents } = useFetch<Agent[]>('/api/agents');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    agent_id: '',
    rule_type: 'regex' as ValidationRule['rule_type'],
    rule_config: '',
  });
  const [testModal, setTestModal] = useState<ValidationRule | null>(null);
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.rule_config.trim()) return;
    setSubmitting(true);
    try {
      await fetchApi('/api/quality/validation-rules', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          agent_id: form.agent_id ? Number(form.agent_id) : null,
          rule_type: form.rule_type,
          rule_config: form.rule_config.trim(),
        }),
      });
      setForm({ name: '', agent_id: '', rule_type: 'regex', rule_config: '' });
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error('Failed to create rule:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: number, enabled: number) {
    try {
      await fetchApi(`/api/quality/validation-rules/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: enabled ? 0 : 1 }),
      });
      refetch();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  }

  function runLocalTest(rule: ValidationRule) {
    try {
      const config = JSON.parse(rule.rule_config);
      let pass = false;
      switch (rule.rule_type) {
        case 'regex': pass = new RegExp(config.pattern || config).test(testText); break;
        case 'min_length': pass = testText.length >= (config.min || config); break;
        case 'max_length': pass = testText.length <= (config.max || config); break;
        case 'contains': pass = testText.includes(config.text || config); break;
        case 'not_contains': pass = !testText.includes(config.text || config); break;
        default: pass = false;
      }
      setTestResult(pass ? 'PASS - Text satisfies the rule' : 'FAIL - Text does not satisfy the rule');
    } catch {
      try {
        let pass = false;
        switch (rule.rule_type) {
          case 'regex': pass = new RegExp(rule.rule_config).test(testText); break;
          case 'min_length': pass = testText.length >= Number(rule.rule_config); break;
          case 'max_length': pass = testText.length <= Number(rule.rule_config); break;
          case 'contains': pass = testText.includes(rule.rule_config); break;
          case 'not_contains': pass = !testText.includes(rule.rule_config); break;
          default: pass = false;
        }
        setTestResult(pass ? 'PASS - Text satisfies the rule' : 'FAIL - Text does not satisfy the rule');
      } catch {
        setTestResult('Error: Could not parse rule config');
      }
    }
  }

  function getConfigPlaceholder(type: string) {
    switch (type) {
      case 'regex': return '{"pattern": "^[A-Z]"}';
      case 'min_length': return '{"min": 10}';
      case 'max_length': return '{"max": 5000}';
      case 'contains': return '{"text": "TODO"}';
      case 'not_contains': return '{"text": "FIXME"}';
      case 'json_schema': return '{"type": "object"}';
      default: return '{}';
    }
  }

  const ruleTypeColors: Record<string, string> = {
    regex: 'bg-purple-500/20 text-purple-400',
    min_length: 'bg-blue-500/20 text-blue-400',
    max_length: 'bg-cyan-500/20 text-cyan-400',
    json_schema: 'bg-amber-500/20 text-amber-400',
    contains: 'bg-green-500/20 text-green-400',
    not_contains: 'bg-red-500/20 text-red-400',
  };

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading validation rules...</div>;
  if (error) return <div className="text-red-400 py-8 text-center">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30">
          {showForm ? 'Cancel' : 'New Rule'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-6 shadow-lg shadow-black/20 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Rule Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder="e.g. Output must start with uppercase" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Agent (optional)</label>
              <select value={form.agent_id} onChange={(e) => setForm((p) => ({ ...p, agent_id: e.target.value }))} className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
                <option value="">All Agents</option>
                {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Rule Type</label>
            <select value={form.rule_type} onChange={(e) => setForm((p) => ({ ...p, rule_type: e.target.value as ValidationRule['rule_type'] }))} className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20">
              {RULE_TYPES.map((rt) => <option key={rt} value={rt}>{rt}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Rule Config (JSON)</label>
            <textarea value={form.rule_config} onChange={(e) => setForm((p) => ({ ...p, rule_config: e.target.value }))} rows={2} required className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20" placeholder={getConfigPlaceholder(form.rule_type)} />
          </div>
          <button type="submit" disabled={submitting} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Rule'}
          </button>
        </form>
      )}

      {/* Test Modal */}
      {testModal && (
        <div className="rounded-xl border border-indigo-500/30 bg-slate-800/50 p-6 shadow-lg shadow-black/20 backdrop-blur-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-100">Test: {testModal.name}</h3>
            <button onClick={() => { setTestModal(null); setTestText(''); setTestResult(null); }} className="text-sm text-slate-400 hover:text-slate-200 transition-colors">Close</button>
          </div>
          <textarea
            value={testText}
            onChange={(e) => { setTestText(e.target.value); setTestResult(null); }}
            rows={3}
            placeholder="Paste text to test against this rule..."
            className="w-full rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white placeholder-slate-500 transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button onClick={() => runLocalTest(testModal)} className="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-500/30">
            Run Test
          </button>
          {testResult && (
            <div className={`rounded-md p-3 text-sm font-medium ${testResult.startsWith('PASS') ? 'bg-green-500/20 text-green-400' : testResult.startsWith('FAIL') ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {testResult}
            </div>
          )}
        </div>
      )}

      {!rules || rules.length === 0 ? (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center shadow-lg shadow-black/20">
          <FileCheck className="mx-auto h-8 w-8 text-slate-600 mb-3" />
          <p className="text-slate-500">No validation rules yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 shadow-lg shadow-black/20 backdrop-blur-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-100">{r.name}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ruleTypeColors[r.rule_type] || 'bg-slate-600/50 text-slate-400'}`}>{r.rule_type}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/50 text-slate-400'}`}>
                      {r.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                    <span>Agent: {r.agent_name || 'All agents'}</span>
                    <span className="font-mono truncate max-w-xs">Config: {r.rule_config.length > 50 ? r.rule_config.slice(0, 50) + '...' : r.rule_config}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => { setTestModal(r); setTestText(''); setTestResult(null); }} className="rounded-lg bg-slate-700/50 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all duration-200 hover:bg-slate-600/50">
                    Test
                  </button>
                  <button
                    onClick={() => handleToggle(r.id, r.enabled)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium text-white transition-all duration-200 ${r.enabled ? 'bg-slate-600/50 hover:bg-slate-500/50' : 'bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20'}`}
                  >
                    {r.enabled ? 'Disable' : 'Enable'}
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

/* ─── Version History ─── */

function VersionsSection() {
  const { data: tickets } = useFetch<Ticket[]>('/api/tickets');
  const [selectedTicket, setSelectedTicket] = useState('');
  const { data: versions, loading, error, refetch } = useFetch<TicketVersion[]>(
    selectedTicket ? `/api/quality/versions/${selectedTicket}` : '',
  );
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [rollingBack, setRollingBack] = useState<number | null>(null);

  function toggleExpand(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function handleRollback(versionId: number) {
    if (!selectedTicket) return;
    setRollingBack(versionId);
    try {
      await fetchApi(`/api/quality/versions/${selectedTicket}/rollback/${versionId}`, {
        method: 'POST',
      });
      refetch();
    } catch (err) {
      console.error('Failed to rollback:', err);
    } finally {
      setRollingBack(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-500">Select Ticket</label>
        <select
          value={selectedTicket}
          onChange={(e) => setSelectedTicket(e.target.value)}
          className="w-full max-w-md rounded-lg border border-slate-600/50 bg-slate-900/50 px-4 py-2.5 text-sm text-white transition-all duration-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          <option value="">Choose a ticket...</option>
          {tickets?.map((t) => <option key={t.id} value={t.id}>#{t.id} - {t.title}</option>)}
        </select>
      </div>

      {!selectedTicket && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center shadow-lg shadow-black/20">
          <Clock className="mx-auto h-8 w-8 text-slate-600 mb-3" />
          <p className="text-slate-500">Select a ticket to view its version history.</p>
        </div>
      )}

      {selectedTicket && loading && <div className="text-slate-400 py-8 text-center">Loading versions...</div>}
      {selectedTicket && error && <div className="text-red-400 py-8 text-center">Error: {error}</div>}

      {selectedTicket && versions && versions.length === 0 && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 py-16 text-center shadow-lg shadow-black/20">
          <Clock className="mx-auto h-8 w-8 text-slate-600 mb-3" />
          <p className="text-slate-500">No versions for this ticket.</p>
        </div>
      )}

      {selectedTicket && versions && versions.length > 0 && (
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-700/50" />
          {versions.sort((a, b) => b.version_number - a.version_number).map((v) => (
            <div key={v.id} className="relative pl-10 pb-4">
              {/* Dot */}
              <div className="absolute left-2.5 top-4 h-3 w-3 rounded-full border-2 border-indigo-500 bg-slate-900" />
              <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-4 shadow-lg shadow-black/20 backdrop-blur-sm space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded bg-indigo-600/20 px-2 py-0.5 text-xs font-semibold text-indigo-400">v{v.version_number}</span>
                  <span className="text-xs text-slate-500">{v.agent_name || `Agent #${v.agent_id}`}</span>
                  <span className="text-xs text-slate-500">{new Date(v.created_at).toLocaleString()}</span>
                  <button
                    onClick={() => handleRollback(v.id)}
                    disabled={rollingBack === v.id}
                    className="ml-auto flex items-center gap-1 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white shadow-lg shadow-amber-500/20 transition-all duration-200 hover:bg-amber-500 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" /> {rollingBack === v.id ? 'Rolling back...' : 'Rollback'}
                  </button>
                </div>
                <div>
                  <button onClick={() => toggleExpand(v.id)} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300">
                    {expanded.has(v.id) ? <><ChevronUp className="h-3 w-3" /> Collapse</> : <><ChevronDown className="h-3 w-3" /> Expand result</>}
                  </button>
                  {expanded.has(v.id) && (
                    <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-300">{v.result}</pre>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
