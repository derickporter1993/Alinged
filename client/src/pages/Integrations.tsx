import { useState, useRef } from 'react';
import { useFetch } from '../hooks/useFetch';
import { fetchApi } from '../api';
import type { Webhook, AgentTool, Agent } from '../../shared/types';

type Tab = 'webhooks' | 'tools' | 'importexport';

export default function Integrations() {
  const [tab, setTab] = useState<Tab>('webhooks');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'webhooks', label: 'Webhooks' },
    { key: 'tools', label: 'Agent Tools' },
    { key: 'importexport', label: 'Import/Export' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-100">Integrations</h1>
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
      {tab === 'webhooks' && <WebhooksSection />}
      {tab === 'tools' && <AgentToolsSection />}
      {tab === 'importexport' && <ImportExportSection />}
    </div>
  );
}

/* ─── Webhooks ─── */

const COMMON_EVENTS = ['ticket_created', 'ticket_done', 'ticket_failed', 'agent_started', 'agent_stopped', 'budget_alert', 'checkpoint_pending'];

function WebhooksSection() {
  const { data: webhooks, loading, error, refetch } = useFetch<Webhook[]>('/api/webhooks');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: '',
  });

  function toggleEvent(ev: string) {
    setForm((p) => ({
      ...p,
      events: p.events.includes(ev) ? p.events.filter((e) => e !== ev) : [...p.events, ev],
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.url.trim() || form.events.length === 0) return;
    setSubmitting(true);
    try {
      await fetchApi('/api/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          name: form.name.trim(),
          url: form.url.trim(),
          events: JSON.stringify(form.events),
          secret: form.secret.trim() || null,
        }),
      });
      setForm({ name: '', url: '', events: [], secret: '' });
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error('Failed to create webhook:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTest(id: number) {
    setTesting(id);
    try {
      await fetchApi(`/api/webhooks/${id}/test`, { method: 'POST' });
    } catch (err) {
      console.error('Failed to test webhook:', err);
    } finally {
      setTesting(null);
    }
  }

  async function handleToggle(id: number, enabled: number) {
    try {
      await fetchApi(`/api/webhooks/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: enabled ? 0 : 1 }),
      });
      refetch();
    } catch (err) {
      console.error('Failed to toggle webhook:', err);
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetchApi(`/api/webhooks/${id}`, { method: 'DELETE' });
      refetch();
    } catch (err) {
      console.error('Failed to delete webhook:', err);
    }
  }

  if (loading) return <div className="text-slate-400 py-8 text-center">Loading webhooks...</div>;
  if (error) return <div className="text-red-400 py-8 text-center">Error: {error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
          {showForm ? 'Cancel' : 'New Webhook'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-slate-700 bg-slate-800 p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Webhook name" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">URL</label>
              <input type="url" value={form.url} onChange={(e) => setForm((p) => ({ ...p, url: e.target.value }))} required className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="https://..." />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Events</label>
            <div className="flex flex-wrap gap-2">
              {COMMON_EVENTS.map((ev) => (
                <label key={ev} className="flex items-center gap-1.5 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.events.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="rounded border-slate-600 bg-slate-700 text-indigo-600 focus:ring-indigo-500"
                  />
                  {ev}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Secret (optional)</label>
            <input type="password" value={form.secret} onChange={(e) => setForm((p) => ({ ...p, secret: e.target.value }))} className="w-full max-w-md rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Webhook secret" />
          </div>
          <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Webhook'}
          </button>
        </form>
      )}

      {!webhooks || webhooks.length === 0 ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800 py-12 text-center text-slate-500">No webhooks yet.</div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((w) => {
            let events: string[] = [];
            try { events = JSON.parse(w.events); } catch { events = [w.events]; }
            return (
              <div key={w.id} className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-100">{w.name}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${w.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/50 text-slate-400'}`}>
                        {w.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 font-mono truncate">{w.url}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {events.map((ev, i) => (
                        <span key={i} className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-400">{ev}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleTest(w.id)}
                      disabled={testing === w.id}
                      className="rounded-md bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-600 disabled:opacity-50"
                    >
                      {testing === w.id ? 'Testing...' : 'Test'}
                    </button>
                    <button
                      onClick={() => handleToggle(w.id, w.enabled)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${w.enabled ? 'bg-slate-600 hover:bg-slate-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                    >
                      {w.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button onClick={() => handleDelete(w.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
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

/* ─── Agent Tools ─── */

const TOOL_TYPES: AgentTool['tool_type'][] = ['web_search', 'file_io', 'api_call', 'code_exec'];

function AgentToolsSection() {
  const { data: agents } = useFetch<Agent[]>('/api/agents');
  const [selectedAgent, setSelectedAgent] = useState('');
  const { data: tools, loading, error, refetch } = useFetch<AgentTool[]>(
    selectedAgent ? `/api/agents/${selectedAgent}/tools` : '',
  );
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ tool_type: 'web_search' as AgentTool['tool_type'], config: '{}' });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedAgent) return;
    setSubmitting(true);
    try {
      await fetchApi(`/api/agents/${selectedAgent}/tools`, {
        method: 'POST',
        body: JSON.stringify({
          tool_type: form.tool_type,
          config: form.config.trim() || null,
        }),
      });
      setForm({ tool_type: 'web_search', config: '{}' });
      setShowForm(false);
      refetch();
    } catch (err) {
      console.error('Failed to add tool:', err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: number, enabled: number) {
    try {
      await fetchApi(`/api/agent-tools/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: enabled ? 0 : 1 }),
      });
      refetch();
    } catch (err) {
      console.error('Failed to toggle tool:', err);
    }
  }

  async function handleDelete(id: number) {
    try {
      await fetchApi(`/api/agent-tools/${id}`, { method: 'DELETE' });
      refetch();
    } catch (err) {
      console.error('Failed to delete tool:', err);
    }
  }

  const toolTypeColors: Record<string, string> = {
    web_search: 'bg-blue-500/20 text-blue-400',
    file_io: 'bg-amber-500/20 text-amber-400',
    api_call: 'bg-green-500/20 text-green-400',
    code_exec: 'bg-purple-500/20 text-purple-400',
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Select Agent</label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Choose agent...</option>
            {agents?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        {selectedAgent && (
          <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
            {showForm ? 'Cancel' : 'Add Tool'}
          </button>
        )}
      </div>

      {!selectedAgent && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 py-12 text-center text-slate-500">Select an agent to manage their tools.</div>
      )}

      {selectedAgent && showForm && (
        <form onSubmit={handleCreate} className="rounded-lg border border-slate-700 bg-slate-800 p-5 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Tool Type</label>
            <select value={form.tool_type} onChange={(e) => setForm((p) => ({ ...p, tool_type: e.target.value as AgentTool['tool_type'] }))} className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
              {TOOL_TYPES.map((tt) => <option key={tt} value={tt}>{tt}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-300">Config (JSON)</label>
            <textarea value={form.config} onChange={(e) => setForm((p) => ({ ...p, config: e.target.value }))} rows={3} className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm font-mono text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder='{"api_key": "..."}' />
          </div>
          <button type="submit" disabled={submitting} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50">
            {submitting ? 'Adding...' : 'Add Tool'}
          </button>
        </form>
      )}

      {selectedAgent && loading && <div className="text-slate-400 py-8 text-center">Loading tools...</div>}
      {selectedAgent && error && <div className="text-red-400 py-8 text-center">Error: {error}</div>}

      {selectedAgent && tools && tools.length === 0 && (
        <div className="rounded-lg border border-slate-700 bg-slate-800 py-12 text-center text-slate-500">No tools configured for this agent.</div>
      )}

      {selectedAgent && tools && tools.length > 0 && (
        <div className="space-y-3">
          {tools.map((t) => (
            <div key={t.id} className="rounded-lg border border-slate-700 bg-slate-800 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${toolTypeColors[t.tool_type] || 'bg-slate-600/50 text-slate-400'}`}>{t.tool_type}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.enabled ? 'bg-green-500/20 text-green-400' : 'bg-slate-600/50 text-slate-400'}`}>
                    {t.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                  {t.config && <span className="text-xs font-mono text-slate-500 truncate max-w-xs">{t.config.length > 50 ? t.config.slice(0, 50) + '...' : t.config}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggle(t.id, t.enabled)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium text-white ${t.enabled ? 'bg-slate-600 hover:bg-slate-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}
                  >
                    {t.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => handleDelete(t.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Import/Export ─── */

function ImportExportSection() {
  const [goalsPreview, setGoalsPreview] = useState<string | null>(null);
  const [agentsPreview, setAgentsPreview] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const goalsFileRef = useRef<HTMLInputElement>(null);
  const agentsFileRef = useRef<HTMLInputElement>(null);

  async function handleExport(type: 'goals' | 'agents') {
    try {
      const data = await fetchApi<unknown[]>(`/api/${type}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-export.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Failed to export ${type}:`, err);
    }
  }

  function handleFileSelect(type: 'goals' | 'agents', file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      try {
        const parsed = JSON.parse(text);
        const preview = JSON.stringify(parsed, null, 2).slice(0, 500);
        if (type === 'goals') setGoalsPreview(preview + (text.length > 500 ? '\n...' : ''));
        else setAgentsPreview(preview + (text.length > 500 ? '\n...' : ''));
      } catch {
        if (type === 'goals') setGoalsPreview('Error: Invalid JSON');
        else setAgentsPreview('Error: Invalid JSON');
      }
    };
    reader.readAsText(file);
  }

  async function handleImport(type: 'goals' | 'agents') {
    const fileInput = type === 'goals' ? goalsFileRef.current : agentsFileRef.current;
    const file = fileInput?.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await fetchApi(`/api/${type}/import`, {
        method: 'POST',
        body: JSON.stringify({ items: Array.isArray(data) ? data : [data] }),
      });
      setImportResult(`Successfully imported ${type}`);
      if (type === 'goals') { setGoalsPreview(null); if (goalsFileRef.current) goalsFileRef.current.value = ''; }
      else { setAgentsPreview(null); if (agentsFileRef.current) agentsFileRef.current.value = ''; }
    } catch (err) {
      setImportResult(`Failed to import ${type}: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      {importResult && (
        <div className={`rounded-md p-3 text-sm font-medium ${importResult.startsWith('Success') ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
          {importResult}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Export */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5 space-y-4">
          <h3 className="text-lg font-semibold text-slate-100">Export</h3>
          <p className="text-sm text-slate-400">Download your data as JSON files.</p>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => handleExport('goals')} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              Export Goals
            </button>
            <button onClick={() => handleExport('agents')} className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500">
              Export Agents
            </button>
          </div>
        </div>

        {/* Import */}
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-5 space-y-4">
          <h3 className="text-lg font-semibold text-slate-100">Import</h3>
          <p className="text-sm text-slate-400">Upload JSON files to import data.</p>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Goals JSON</label>
              <input
                ref={goalsFileRef}
                type="file"
                accept=".json"
                onChange={(e) => handleFileSelect('goals', e.target.files?.[0])}
                className="w-full text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-300 hover:file:bg-slate-600"
              />
              {goalsPreview && (
                <div className="mt-2">
                  <pre className="max-h-32 overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-400">{goalsPreview}</pre>
                  <button onClick={() => handleImport('goals')} disabled={importing || goalsPreview.startsWith('Error')} className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                    {importing ? 'Importing...' : 'Import Goals'}
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-300">Agents JSON</label>
              <input
                ref={agentsFileRef}
                type="file"
                accept=".json"
                onChange={(e) => handleFileSelect('agents', e.target.files?.[0])}
                className="w-full text-sm text-slate-400 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-300 hover:file:bg-slate-600"
              />
              {agentsPreview && (
                <div className="mt-2">
                  <pre className="max-h-32 overflow-auto rounded bg-slate-900 p-2 text-xs text-slate-400">{agentsPreview}</pre>
                  <button onClick={() => handleImport('agents')} disabled={importing || agentsPreview.startsWith('Error')} className="mt-2 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
                    {importing ? 'Importing...' : 'Import Agents'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
