import type { ButtonHTMLAttributes } from "react";

type ChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  tone?: "light" | "onGlass";
};

export function Chip({ active, tone = "light", className = "", children, ...props }: ChipProps) {
  const base =
    tone === "onGlass"
      ? active
        ? "bg-ink text-[#f4f5f6]"
        : "bg-ink/6 text-ink/65 hover:bg-ink/10"
      : active
        ? "bg-ink text-[#f4f5f6]"
        : "bg-ink/6 text-ink/65 hover:bg-ink/10";
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${base} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
