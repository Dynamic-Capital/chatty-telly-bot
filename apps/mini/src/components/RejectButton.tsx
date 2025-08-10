import type { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export default function RejectButton(
  { label, className = "", ...rest }: Props,
) {
  return (
    <button className={`dc-btn dc-btn--reject ${className}`} {...rest}>
      {label}
    </button>
  );
}
