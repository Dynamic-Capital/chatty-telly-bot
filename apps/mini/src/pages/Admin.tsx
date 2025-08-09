import { useEffect, useState } from 'react';
import GlassRow from '../components/GlassRow';
import ApproveButton from '../components/ApproveButton';
import RejectButton from '../components/RejectButton';
import TopBar from '../components/TopBar';
import { useApi } from '../hooks/useApi';

interface Receipt {
  id: string;
  amount: number;
}

export default function Admin() {
  const api = useApi();
  const [items, setItems] = useState<Receipt[]>([]);

  useEffect(() => {
    api.getPending().then(setItems);
  }, [api]);

  return (
    <div className='dc-screen'>
      <TopBar title='Admin' />
      {items.map((r) => (
        <GlassRow
          key={r.id}
          left={<span className='text-sm'>{r.id.slice(0, 6)}…</span>}
          right={
            <div className='flex gap-2'>
              <ApproveButton label='Approve' onClick={() => api.approve(r.id)} />
              <RejectButton label='Reject' onClick={() => api.reject(r.id)} />
            </div>
          }
        />
      ))}
    </div>
  );
}
