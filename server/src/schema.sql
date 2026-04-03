CREATE TABLE IF NOT EXISTS providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL,
  base_url TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','completed','paused')),
  autopilot INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  provider_id INTEGER NOT NULL REFERENCES providers(id),
  model TEXT NOT NULL,
  system_prompt TEXT,
  reports_to INTEGER REFERENCES agents(id),
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle','busy','paused','terminated')),
  budget_limit REAL DEFAULT 0,
  budget_spent REAL DEFAULT 0,
  requires_approval INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id INTEGER REFERENCES goals(id),
  agent_id INTEGER REFERENCES agents(id),
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'backlog' CHECK (status IN ('backlog','todo','in_progress','review','done','failed')),
  priority INTEGER DEFAULT 0,
  result TEXT,
  parent_id INTEGER REFERENCES tickets(id),
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS cost_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES agents(id),
  ticket_id INTEGER REFERENCES tickets(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Agent-to-agent messaging
CREATE TABLE IF NOT EXISTS agent_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_agent_id INTEGER NOT NULL REFERENCES agents(id),
  to_agent_id INTEGER NOT NULL REFERENCES agents(id),
  ticket_id INTEGER REFERENCES tickets(id),
  content TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Review chains (multi-agent review pipelines)
CREATE TABLE IF NOT EXISTS review_chains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  steps TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Shared knowledge base
CREATE TABLE IF NOT EXISTS knowledge_base (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  author_agent_id INTEGER REFERENCES agents(id),
  tags TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Recurring ticket schedules
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  goal_id INTEGER REFERENCES goals(id),
  agent_id INTEGER REFERENCES agents(id),
  priority INTEGER DEFAULT 0,
  cron_expression TEXT NOT NULL,
  next_run TEXT,
  last_run TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Workflow triggers (event-driven automation)
CREATE TABLE IF NOT EXISTS workflow_triggers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  condition_config TEXT,
  action_config TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Human-in-the-loop checkpoints
CREATE TABLE IF NOT EXISTS checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  agent_id INTEGER NOT NULL REFERENCES agents(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  output_preview TEXT,
  reviewer_notes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  resolved_at TEXT
);

-- Output validation rules
CREATE TABLE IF NOT EXISTS validation_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  agent_id INTEGER REFERENCES agents(id),
  rule_type TEXT NOT NULL CHECK (rule_type IN ('regex','min_length','max_length','json_schema','contains','not_contains')),
  rule_config TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Ticket output version history
CREATE TABLE IF NOT EXISTS ticket_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  version_number INTEGER NOT NULL,
  result TEXT NOT NULL,
  agent_id INTEGER REFERENCES agents(id),
  created_at TEXT DEFAULT (datetime('now'))
);

-- Full conversation logs for every LLM call
CREATE TABLE IF NOT EXISTS conversation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES agents(id),
  ticket_id INTEGER REFERENCES tickets(id),
  role TEXT NOT NULL CHECK (role IN ('system','user','assistant')),
  content TEXT NOT NULL,
  tokens INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Ticket dependency graph
CREATE TABLE IF NOT EXISTS ticket_dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  depends_on_id INTEGER NOT NULL REFERENCES tickets(id),
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(ticket_id, depends_on_id)
);

-- Webhooks for external notifications
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT NOT NULL,
  secret TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Agent tool configurations
CREATE TABLE IF NOT EXISTS agent_tools (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id INTEGER NOT NULL REFERENCES agents(id),
  tool_type TEXT NOT NULL CHECK (tool_type IN ('web_search','file_io','api_call','code_exec')),
  config TEXT,
  enabled INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
