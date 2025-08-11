import { Routes, Route, Navigate } from 'react-router-dom';
import Payments from './Payments';
import Logs from './Logs';
import AdminTabs from '@/components/admin/Tabs';

export default function Admin() {
  return (
    <div className="space-y-4">
      <AdminTabs />
      <Routes>
        <Route path="payments" element={<Payments />} />
        <Route path="logs" element={<Logs />} />
        <Route index element={<Navigate to="payments" replace />} />
      </Routes>
    </div>
  );
}
