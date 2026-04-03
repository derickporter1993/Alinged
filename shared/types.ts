// Shared types for Alinged AI Agent Orchestration System

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
