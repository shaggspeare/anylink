import type { HTMLAttributes } from "react";

type GlassPanelProps = HTMLAttributes<HTMLDivElement> & {
  level?: 42 | 55 | 70;
};

export function GlassPanel({ level = 55, className = "", ...props }: GlassPanelProps) {
  return <div className={`glass-${level} ${className}`} {...props} />;
}
