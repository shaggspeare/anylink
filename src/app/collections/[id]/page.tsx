import { CollectionView } from "@/components/collection-view";

export default async function CollectionPage(props: PageProps<"/collections/[id]">) {
  const { id } = await props.params;
  return <CollectionView collectionId={id} />;
}
