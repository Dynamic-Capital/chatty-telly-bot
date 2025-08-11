import { Route, Routes, Navigate, Link, useLocation } from 'react-router-dom';
import Landing from '@/routes/Landing';
import Dashboard from '@/routes/Dashboard';

export default function App() {
  const loc = useLocation();
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 text-slate-900 dark:text-slate-100">
      <nav className="sticky top-0 z-10 backdrop-blur bg-white/60 dark:bg-slate-900/60 border-b border-slate-200/50 dark:border-slate-700/40">
        <div className="mx-auto max-w-xl px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-semibold">Dynamic Capital</Link>
          <div className="text-sm opacity-70">{loc.pathname === '/dashboard' ? 'Dashboard' : 'Home'}</div>
        </div>
      </nav>
      <main className="mx-auto max-w-xl p-4">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
