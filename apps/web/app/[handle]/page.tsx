import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProfile } from "@agentprint/database";
import { viewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { ProfileView } from "@/components/profile-view";

export async function generateMetadata({
  params
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  return {
    title: `@${handle}`,
    description: `${handle}'s agent contribution profile on Agentprint.`
  };
}

export default async function PublicProfilePage({
  params
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const current = await viewer();
  const data = await getProfile(handle, current?.id);
  if (!data) notFound();
  return (
    <>
      <SiteHeader current={current} variant="profile" />
      <ProfileView data={data} preview={!data.profile.is_public} />
    </>
  );
}
