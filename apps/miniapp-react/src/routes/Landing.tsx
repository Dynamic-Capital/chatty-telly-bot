import { useNavigate } from 'react-router-dom';
import { useTelegram } from '@/shared/useTelegram';

export default function Landing() {
  const nav = useNavigate();
  const { user } = useTelegram();
  return (
    <section className="card space-y-4">
      <h1 className="text-2xl font-semibold">VIP Mini App</h1>
      <p className="opacity-80">Welcome{user?.first_name ? `, ${user.first_name}` : ''}! Tap below to open your dashboard.</p>
      <button className="btn bg-blue-600 text-white hover:bg-blue-700" onClick={() => nav('/dashboard')}>
        Open Dashboard
      </button>
      <p className="text-xs opacity-60">{user ? `Telegram ID: ${user.id}` : 'No Telegram user detected yet.'}</p>
    </section>
  );
}
