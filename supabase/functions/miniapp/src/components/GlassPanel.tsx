import { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function GlassPanel(
  { children, className = "", onClick }: Props,
) {
  return (
    <div className={`dc-panel ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}
