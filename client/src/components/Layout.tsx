import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LayoutDashboard,
  Target,
  Bot,
  Network,
  Ticket,
  Wallet,
  MessageSquare,
  Timer,
  ShieldCheck,
  Brain,
  Plug,
  Activity,
  LogOut,
  Menu,
  X,
} from 'lucide-react';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/agents', label: 'Agents', icon: Bot },
  { to: '/org-chart', label: 'Org Chart', icon: Network },
  { to: '/tickets', label: 'Tickets', icon: Ticket },
  { to: '/budget', label: 'Budget', icon: Wallet },
  { to: '/collaboration', label: 'Collaboration', icon: MessageSquare },
  { to: '/automation', label: 'Automation', icon: Timer },
  { to: '/quality', label: 'Quality', icon: ShieldCheck },
  { to: '/intelligence', label: 'Intelligence', icon: Brain },
  { to: '/integrations', label: 'Integrations', icon: Plug },
  { to: '/observability', label: 'Observability', icon: Activity },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden transition-opacity duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-slate-900 border-r border-slate-700/50 transition-transform duration-200 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-slate-700/50 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 shadow-lg shadow-indigo-500/20">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-wide text-white">
            HiveMind
          </span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-all duration-200 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Navigation
          </p>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-indigo-600/15 text-indigo-400 shadow-sm shadow-indigo-500/5'
                      : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`h-[18px] w-[18px] flex-shrink-0 transition-all duration-200 ${
                        isActive
                          ? 'text-indigo-400'
                          : 'text-slate-500 group-hover:text-slate-300'
                      }`}
                    />
                    <span>{item.label}</span>
                    {isActive && (
                      <div className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-slate-700/50 p-4">
          {user && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600/20 ring-1 ring-indigo-500/30">
                <span className="text-xs font-semibold text-indigo-400">
                  {getInitials(user.name)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-white">
                  {user.name}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {user.email}
                </p>
              </div>
              <button
                onClick={logout}
                title="Sign out"
                className="flex-shrink-0 rounded-lg p-2 text-slate-500 transition-all duration-200 hover:bg-slate-800 hover:text-slate-300"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-14 items-center gap-3 border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-md px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-400 transition-all duration-200 hover:bg-slate-800 hover:text-slate-200"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 shadow-sm shadow-indigo-500/20">
              <Brain className="h-3.5 w-3.5 text-white" />
            </div>
            <span className="text-base font-bold tracking-wide text-white">
              HiveMind
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
