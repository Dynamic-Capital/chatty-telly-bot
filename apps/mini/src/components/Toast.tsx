import { useEffect } from 'react';

interface Props {
  message: string;
  type: 'success' | 'warn' | 'error';
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: Props) {
  useEffect(() => {
    const id = setTimeout(onClose, 3000);
    return () => clearTimeout(id);
  }, [onClose]);

  const map = {
    success: 'dc-pill--verified',
    warn: 'dc-pill--awaiting',
    error: 'dc-pill--rejected',
  } as const;

  return (
    <div className={`dc-chip ${map[type]} fixed bottom-4 left-1/2 -translate-x-1/2`}>{message}</div>
  );
}
