// SVG stand-ins for the ★ ✕ ✓ ⋯ ↗ ↓ ✎ glyphs: Windows draws those from different fonts
// (or as colour emoji), so the same icon looked different per OS.
const PATHS = {
  pin: <path d="m16 3 5 5-4 1-3 5v3l-7-7h3l5-3zM9 15l-6 6" />,
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
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  share: <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />,
  note: <path d="M5 4h14v11l-5 5H5zM14 20v-5h5M8.5 9h7M8.5 12.5h4.5" />,
  image: <path d="M4 5h16v14H4zM4 16l4.5-4.5 4 4 2.5-2.5L20 18M15.5 9.5h.01" />,
  link: <path d="M9.5 13.5a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14.5 10.5a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  sliders: (
    <g>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </g>
  ),
  "folder-minus": <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 13h6" />,
  trash: <path d="M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13" />,
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  list: <path d="M4 6h16M4 12h16M4 18h16" />,
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
