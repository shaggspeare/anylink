"use client";

/** A section that writes the pointer position as --mx/--my (-1..1); landing.css turns them
 *  into a 3D tilt. */
export function TiltSection(props: React.ComponentProps<"section">) {
  const set = (el: HTMLElement, x: number, y: number) => {
    el.style.setProperty("--mx", x.toFixed(3));
    el.style.setProperty("--my", y.toFixed(3));
  };
  const unit = (v: number) => Math.max(-1, Math.min(1, v * 2 - 1));
  return (
    <section
      {...props}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        set(e.currentTarget, unit((e.clientX - r.left) / r.width), unit((e.clientY - r.top) / r.height));
      }}
      onPointerLeave={(e) => set(e.currentTarget, 0, 0)}
    />
  );
}
