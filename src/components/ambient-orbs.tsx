type Orb = {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  size: number;
  color: string;
  opacity: number;
  blur: number;
};

const VARIANTS: Record<string, Orb[]> = {
  library: [
    { left: -140, top: -120, size: 520, color: "#ff5a1f", opacity: 0.34, blur: 120 },
    { right: -100, top: 180, size: 460, color: "#d6f24b", opacity: 0.4, blur: 130 },
    { right: 280, bottom: -180, size: 520, color: "#7c8cff", opacity: 0.22, blur: 140 },
  ],
  reader: [
    { left: -140, top: -160, size: 520, color: "#ff5a1f", opacity: 0.28, blur: 130 },
    { right: -150, bottom: -180, size: 520, color: "#7c8cff", opacity: 0.24, blur: 140 },
  ],
  product: [
    { left: -150, top: -150, size: 520, color: "#7c8cff", opacity: 0.26, blur: 130 },
    { right: -140, bottom: -170, size: 520, color: "#d6f24b", opacity: 0.3, blur: 140 },
  ],
  dark: [
    { left: -60, top: -80, size: 380, color: "#ff5a1f", opacity: 0.35, blur: 110 },
    { right: -80, bottom: 40, size: 340, color: "#7c8cff", opacity: 0.28, blur: 120 },
  ],
};

export function AmbientOrbs({ variant = "library" }: { variant?: keyof typeof VARIANTS }) {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {VARIANTS[variant].map((orb, i) => (
        <div
          key={i}
          className="ambient-orb"
          style={{
            width: orb.size,
            height: orb.size,
            top: orb.top,
            bottom: orb.bottom,
            left: orb.left,
            right: orb.right,
            background: orb.color,
            opacity: orb.opacity,
            filter: `blur(${orb.blur}px)`,
          }}
        />
      ))}
    </div>
  );
}
