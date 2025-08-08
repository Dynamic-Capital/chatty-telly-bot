import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
}

export default function GlassPanel({ children, className = "" }: Props) {
  return <div className={`dc-panel ${className}`}>{children}</div>;
}
