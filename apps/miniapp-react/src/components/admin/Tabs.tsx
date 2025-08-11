import { NavLink } from 'react-router-dom';

export default function AdminTabs() {
  const base = "flex-1 px-3 py-2 rounded-md text-sm font-medium text-center";
  const active = base + " bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900";
  const inactive = base + " bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200";
  return (
    <div className="flex gap-2 mb-4">
      <NavLink to="/admin/payments" className={({isActive}) => isActive ? active : inactive}>Payments</NavLink>
      <NavLink to="/admin/logs" className={({isActive}) => isActive ? active : inactive}>Logs</NavLink>
    </div>
  );
}
