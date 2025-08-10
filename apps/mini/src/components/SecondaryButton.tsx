import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export default function SecondaryButton(
  { label, className = "", ...rest }: Props,
) {
  return (
    <button className={`dc-btn dc-btn--glass ${className}`} {...rest}>
      {label}
    </button>
  );
}
