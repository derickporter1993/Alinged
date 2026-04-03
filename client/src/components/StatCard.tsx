interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  color = 'border-indigo-500',
}: StatCardProps) {
  return (
    <div
      className={`rounded-lg border border-slate-700 bg-slate-800 p-5 border-l-4 ${color}`}
    >
      <div className="text-3xl font-bold text-slate-100">{value}</div>
      <div className="mt-1 text-sm font-medium text-slate-400">{title}</div>
      {subtitle && (
        <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
      )}
    </div>
  );
}
