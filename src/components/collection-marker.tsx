/** The collection's emoji when it has one, otherwise its colour dot. */
export function CollectionMarker({ color, icon, size = 8 }: { color: string; icon?: string; size?: number }) {
  if (icon) {
    return (
      <span aria-hidden className="inline-block flex-none leading-none" style={{ fontSize: Math.max(size * 1.6, 12) }}>
        {icon}
      </span>
    );
  }
  return (
    <span
      className="inline-block flex-none rounded-full"
      style={{ width: size, height: size, background: color }}
    />
  );
}
