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
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  article: <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5M9 13h6M9 17h4" />,
  video: (
    <g>
      <rect x="2.5" y="5" width="19" height="14" rx="4" />
      <path fill="currentColor" strokeWidth="1.2" d="M9.5 8.6v6.8l5.8-3.4z" />
    </g>
  ),
  cart: (
    <g>
      <path d="M2.5 3.5h2.2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.2h8.6a1.5 1.5 0 0 0 1.5-1.1l1.8-7.3H5.8" />
      <circle cx="9.5" cy="20" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="17" cy="20" r="1.2" fill="currentColor" stroke="none" />
    </g>
  ),
  x: (
    <path
      fill="currentColor"
      stroke="none"
      d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78zm-1.08 16.2h1.7L7.4 4.73H5.58z"
    />
  ),
};

export function Icon({
  name,
  size = 14,
  strokeWidth = 2.6,
  className,
}: {
  name: keyof typeof PATHS;
  size?: number;
  /** 2.6 is tuned for the 14px default; larger icons read better lighter. */
  strokeWidth?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`flex-none ${className ?? ""}`}
    >
      {PATHS[name]}
    </svg>
  );
}
