// Shared types for HiveMind AI Agent Orchestration System

export interface Provider {
  id: number;
  name: string;
  api_key: string;
  base_url: string | null;
  created_at: string;
}

export interface Goal {
  id: number;
  title: string;
  description: string | null;
  status: 'active' | 'completed' | 'paused';
  autopilot: number;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: number;
  name: string;
  role: string;
  provider_id: number;
  model: string;
  system_prompt: string | null;
  reports_to: number | null;
  status: 'idle' | 'busy' | 'paused' | 'terminated';
  budget_limit: number;
  budget_spent: number;
  requires_approval: number;
  created_at: string;
  // Joined fields
  provider_name?: string;
  children?: Agent[];
}

export interface Ticket {
  id: number;
  goal_id: number | null;
  agent_id: number | null;
  title: string;
  description: string | null;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done' | 'failed';
  priority: number;
  result: string | null;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  agent_name?: string;
  goal_title?: string;
}

export interface CostLog {
  id: number;
  agent_id: number;
  ticket_id: number | null;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  created_at: string;
}

export interface Activity {
  id: number;
  type: string;
  message: string;
  metadata: string | null;
  created_at: string;
}

export interface DashboardData {
  activeGoals: number;
  busyAgents: number;
  openTickets: number;
  totalSpent: number;
  ticketsByStatus: Record<string, number>;
  recentActivity: Activity[];
}

export interface BudgetSummary {
  totalSpent: number;
  spentToday: number;
  spentThisWeek: number;
  byAgent: { agent_id: number; agent_name: string; spent: number; limit: number }[];
  byGoal: { goal_id: number; goal_title: string; spent: number }[];
}

// --- Agent Collaboration ---

export interface AgentMessage {
  id: number;
  from_agent_id: number;
  to_agent_id: number;
  ticket_id: number | null;
  content: string;
  created_at: string;
  from_agent_name?: string;
  to_agent_name?: string;
}

export interface ReviewChain {
  id: number;
  name: string;
  steps: string; // JSON array of {agent_id, role, order}
  created_at: string;
}

export interface ReviewChainStep {
  agent_id: number;
  role: string;
  order: number;
}

export interface KnowledgeBaseEntry {
  id: number;
  title: string;
  content: string;
  author_agent_id: number | null;
  tags: string | null;
  created_at: string;
  updated_at: string;
  author_name?: string;
}

// --- Automation & Scheduling ---

export interface Schedule {
  id: number;
  title: string;
  description: string | null;
  goal_id: number | null;
  agent_id: number | null;
  priority: number;
  cron_expression: string;
  next_run: string | null;
  last_run: string | null;
  enabled: number;
  created_at: string;
  agent_name?: string;
  goal_title?: string;
}

export interface WorkflowTrigger {
  id: number;
  name: string;
  trigger_event: string;
  condition_config: string | null;
  action_config: string;
  enabled: number;
  created_at: string;
}

// --- Quality & Safety ---

export interface Checkpoint {
  id: number;
  ticket_id: number;
  agent_id: number;
  status: 'pending' | 'approved' | 'rejected';
  output_preview: string | null;
  reviewer_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  ticket_title?: string;
  agent_name?: string;
}

export interface ValidationRule {
  id: number;
  name: string;
  agent_id: number | null;
  rule_type: 'regex' | 'min_length' | 'max_length' | 'json_schema' | 'contains' | 'not_contains';
  rule_config: string;
  enabled: number;
  created_at: string;
  agent_name?: string;
}

export interface TicketVersion {
  id: number;
  ticket_id: number;
  version_number: number;
  result: string;
  agent_id: number | null;
  created_at: string;
  agent_name?: string;
}

// --- Intelligence ---

export interface AgentScore {
  agent_id: number;
  agent_name: string;
  role: string;
  total_tasks: number;
  successful_tasks: number;
  failed_tasks: number;
  success_rate: number;
  total_cost: number;
  avg_cost_per_task: number;
}

// --- Integrations ---

export interface Webhook {
  id: number;
  name: string;
  url: string;
  events: string;
  secret: string | null;
  enabled: number;
  created_at: string;
}

export interface AgentTool {
  id: number;
  agent_id: number;
  tool_type: 'web_search' | 'file_io' | 'api_call' | 'code_exec';
  config: string | null;
  enabled: number;
  created_at: string;
}

// --- Observability ---

export interface ConversationLog {
  id: number;
  agent_id: number;
  ticket_id: number | null;
  role: 'system' | 'user' | 'assistant';
  content: string;
  tokens: number;
  created_at: string;
  agent_name?: string;
}

export interface TicketDependency {
  id: number;
  ticket_id: number;
  depends_on_id: number;
  created_at: string;
  ticket_title?: string;
  depends_on_title?: string;
}

export interface CostForecast {
  dailyRate: number;
  weeklyRate: number;
  monthlyProjection: number;
  daysOfData: number;
}
