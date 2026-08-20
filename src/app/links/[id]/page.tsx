import { LinkDetailView } from "@/components/link-detail-view";

export default async function LinkDetailPage(props: PageProps<"/links/[id]">) {
  const { id } = await props.params;
  return <LinkDetailView linkId={id} />;
}
