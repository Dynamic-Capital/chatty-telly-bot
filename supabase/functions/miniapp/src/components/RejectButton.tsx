import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: ReactNode;
}

export default function RejectButton(
  { label, icon = null, className = "", ...rest }: Props,
) {
  return (
    <button className={`dc-btn dc-btn--reject ${className}`} {...rest}>
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
    </button>
  );
}
