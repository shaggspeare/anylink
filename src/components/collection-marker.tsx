export function CollectionMarker({ color, size = 8 }: { color: string; size?: number }) {
  return (
    <span
      className="inline-block flex-none rounded-full"
      style={{ width: size, height: size, background: color }}
    />
  );
}
