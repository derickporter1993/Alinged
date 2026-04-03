import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  subtitle?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export default function StatCard({
  label,
  value,
  color = 'text-indigo-400',
  subtitle,
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-800/40 p-5 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-200 hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-0.5">
      {/* Glass shimmer overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.03] via-transparent to-transparent" />
      <div className="pointer-events-none absolute -inset-1 rounded-xl bg-gradient-to-br from-indigo-500/0 to-purple-500/0 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-10" />

      <div className="relative flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-white">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1.5 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>

        {Icon ? (
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700/60 to-slate-700/30 ring-1 ring-white/5 transition-all duration-200 group-hover:scale-105 group-hover:ring-white/10`}
          >
            <Icon className={`h-5 w-5 ${color}`} />
          </div>
        ) : (
          <div className="mt-1.5 flex shrink-0 items-center justify-center">
            <span
              className={`block h-2.5 w-2.5 rounded-full ${color.replace('text-', 'bg-')} shadow-sm ${color.replace('text-', 'shadow-')}/40`}
            />
          </div>
        )}
      </div>
    </div>
  );
}
