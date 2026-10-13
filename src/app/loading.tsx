import Image from "next/image";

/** While a route streams in: the logo on the canvas. */
export default function Loading() {
  return (
    <div role="status" aria-label="Loading" className="grid min-h-screen place-items-center bg-canvas">
      <Image src="/images/logo.png" alt="" width={72} height={72} priority className="motion-safe:animate-pulse" />
    </div>
  );
}
