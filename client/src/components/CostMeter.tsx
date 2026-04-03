import { DollarSign, TrendingUp } from 'lucide-react';

interface CostMeterProps {
  spent: number;
  limit: number;
  label: string;
}

export default function CostMeter({ spent, limit, label }: CostMeterProps) {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const remaining = Math.max(limit - spent, 0);
  const isCritical = pct >= 90;
  const isWarning = pct >= 60;

  let barColor = 'bg-emerald-500';
  let barGlow = 'shadow-emerald-500/25';
  let pctBadge = 'bg-emerald-500/10 text-emerald-400 ring-emerald-500/20';
  if (isCritical) {
    barColor = 'bg-red-500';
    barGlow = 'shadow-red-500/30';
    pctBadge = 'bg-red-500/10 text-red-400 ring-red-500/20';
  } else if (isWarning) {
    barColor = 'bg-amber-500';
    barGlow = 'shadow-amber-500/25';
    pctBadge = 'bg-amber-500/10 text-amber-400 ring-amber-500/20';
  }

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-br from-slate-800/80 to-slate-800/40 p-5 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-200 ${
        isCritical ? 'border-red-500/30' : ''
      }`}
    >
      {/* Critical pulse overlay */}
      {isCritical && (
        <div className="pointer-events-none absolute inset-0 rounded-xl bg-red-500/[0.03]" />
      )}

      {/* Header */}
      <div className="relative flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${
              isCritical
                ? 'bg-red-500/10 ring-red-500/20'
                : 'bg-slate-700/40 ring-white/5'
            }`}
          >
            <DollarSign
              className={`h-4.5 w-4.5 ${
                isCritical ? 'text-red-400' : 'text-slate-400'
              }`}
            />
          </div>
          <span className="text-sm font-semibold text-white">{label}</span>
        </div>
        <span
          className={`rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ${pctBadge}`}
        >
          {pct.toFixed(1)}%
        </span>
      </div>

      {/* Dollar amounts */}
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="text-2xl font-extrabold tracking-tight text-white">
          ${spent.toFixed(2)}
        </span>
        <span className="text-sm font-medium text-slate-500">
          / ${limit.toFixed(2)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mt-3.5 relative h-3.5 w-full overflow-hidden rounded-full bg-slate-700/60">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor} ${barGlow} shadow-sm`}
          style={{ width: `${pct}%` }}
        />
        {/* Subtle track marks */}
        <div className="pointer-events-none absolute inset-0 flex justify-between px-px">
          {[25, 50, 75].map((mark) => (
            <div
              key={mark}
              className="h-full w-px bg-slate-600/30"
              style={{ marginLeft: `${mark}%` }}
            />
          ))}
        </div>
      </div>

      {/* Remaining */}
      <div className="mt-2.5 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1 text-slate-500">
          <TrendingUp className="h-3 w-3" />
          ${remaining.toFixed(2)} remaining
        </span>
        {isCritical && (
          <span className="font-medium text-red-400">Budget critical</span>
        )}
      </div>
    </div>
  );
}
