import Image from "next/image";
import { getT } from "@/i18n/server";

/** While a route streams in: the logo on the canvas. */
export default async function Loading() {
  const t = await getT();
  return (
    <div role="status" aria-label={t("Loading")} className="grid min-h-screen place-items-center bg-canvas">
      <Image src="/images/logo.png" alt="" width={72} height={72} priority className="motion-safe:animate-pulse" />
    </div>
  );
}
