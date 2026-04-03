interface CostMeterProps {
  spent: number;
  limit: number;
  label: string;
}

export default function CostMeter({ spent, limit, label }: CostMeterProps) {
  const pct = limit > 0 ? Math.min((spent / limit) * 100, 100) : 0;
  const isCritical = pct >= 90;

  let barColor = 'bg-green-500';
  if (pct >= 90) barColor = 'bg-red-500';
  else if (pct >= 60) barColor = 'bg-yellow-500';

  return (
    <div className={`rounded-lg border border-slate-700 bg-slate-800 p-4 ${isCritical ? 'budget-critical' : ''}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-200">{label}</span>
        <span className="text-xs text-slate-400">
          ${spent.toFixed(2)} / ${limit.toFixed(2)}
        </span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-slate-700">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 text-right text-xs text-slate-500">
        {pct.toFixed(1)}% used
      </div>
    </div>
  );
}
