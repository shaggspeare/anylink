import Image from "next/image";

/** App-icon tile: the chain in a transparent rounded square with a glass rim.
 *  Size it with className (h-/w-); radius scales with it. */
export function Logo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-[28%] ${className}`}
      style={{
        // Glass rim only — the inside stays fully transparent.
        border: "1.5px solid rgb(var(--surface-rgb) / .85)",
        boxShadow: "inset 0 0 0 .5px rgba(23,24,27,.06), 0 1px 6px rgba(23,24,27,.08)",
      }}
    >
      <span className="relative h-[78%] w-[78%]">
        <Image src="/images/logo.png" alt="" fill sizes="96px" priority />
      </span>
    </span>
  );
}
