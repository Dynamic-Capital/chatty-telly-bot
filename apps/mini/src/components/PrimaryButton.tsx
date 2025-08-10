import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export default function PrimaryButton(
  { label, className = "", ...rest }: Props,
) {
  return (
    <button className={`dc-btn dc-btn--primary ${className}`} {...rest}>
      {label}
    </button>
  );
}
