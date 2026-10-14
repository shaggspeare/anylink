import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { getSharedCollection } from "@/lib/db/queries";
import { linkCount } from "@/lib/format";
import { SharedCollectionView } from "@/components/shared-collection-view";

/** A shared collection, for anyone holding the link (docs/adr/0001). */
export default async function SharedPage(props: PageProps<"/s/[token]">) {
  const { token } = await props.params;
  const shared = await getSharedCollection(token);
  if (!shared) notFound();
  // In-app browsers (Telegram, Instagram…) and Safari's address bar never hand a universal link to the app,
  // so iPhones also get an "Open in app" button on the app's own scheme.
  const iOS = /iPhone|iPad|iPod/.test((await headers()).get("user-agent") ?? "");
  return <SharedCollectionView token={token} shared={shared} iOS={iOS} />;
}

export async function generateMetadata(props: PageProps<"/s/[token]">): Promise<Metadata> {
  const shared = await getSharedCollection((await props.params).token);
  if (!shared) return { robots: { index: false } };
  const cover = shared.links.find((l) => l.heroImage)?.heroImage;
  const description = [linkCount(shared.links.length), shared.ownerName && `shared by ${shared.ownerName}`]
    .filter(Boolean)
    .join(" · ");
  return {
    title: `${shared.name} — AnyLink`,
    description,
    // Unlisted: reachable by link, never by search.
    robots: { index: false, follow: false },
    openGraph: { title: shared.name, description, images: cover ? [cover] : undefined },
  };
}
