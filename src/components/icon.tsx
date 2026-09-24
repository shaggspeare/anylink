// SVG stand-ins for the ★ ✕ ✓ ⋯ ↗ ↓ ✎ glyphs: Windows draws those from different fonts
// (or as colour emoji), so the same icon looked different per OS.
const PATHS = {
  star: <path fill="currentColor" stroke="none" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.5 1.2 6.4L12 17.3l-5.7 3.1 1.2-6.4-4.7-4.5 6.4-.8z" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  more: (
    <g fill="currentColor" stroke="none">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </g>
  ),
  "arrow-up-right": <path d="M7 17 17 7M9 7h8v8" />,
  "arrow-down": <path d="M12 5v14M6 13l6 6 6-6" />,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4" />,
};

export function Icon({ name, size = 14, className }: { name: keyof typeof PATHS; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className ?? ""}`}
    >
      {PATHS[name]}
    </svg>
  );
}
