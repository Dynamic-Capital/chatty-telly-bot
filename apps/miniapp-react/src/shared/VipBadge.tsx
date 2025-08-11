export default function VipBadge({ value }: { value: boolean | null }) {
  if (value === true) return <div className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-400"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>Active VIP</div>;
  if (value === false) return <div className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-400"><span className="h-2.5 w-2.5 rounded-full bg-amber-500"></span>Inactive / Expired</div>;
  return <div className="inline-flex items-center gap-2 text-slate-500"><span className="h-2.5 w-2.5 rounded-full bg-slate-400"></span>Unknown</div>;
}
