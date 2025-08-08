import { ReactNode } from 'react';

interface Props {
  left: ReactNode;
  right?: ReactNode;
  className?: string;
}

export default function GlassRow({ left, right, className = "" }: Props) {
  return (
    <div className={`dc-row ${className}`}>
      <div>{left}</div>
      {right && <div>{right}</div>}
    </div>
  );
}
