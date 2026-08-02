import { permanentRedirect } from "next/navigation";

export default async function LegacyProfilePage({
  params
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  permanentRedirect(`/${encodeURIComponent(handle)}`);
}
