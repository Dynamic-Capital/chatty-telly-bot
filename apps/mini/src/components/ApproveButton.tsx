import type { ButtonHTMLAttributes } from 'react';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export default function ApproveButton({ label, className = '', ...rest }: Props) {
  return (
    <button className={`dc-btn dc-btn--approve ${className}`} {...rest}>
      {label}
    </button>
  );
}
