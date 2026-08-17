import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findFriendCandidate, getProfile, getProfileIdentity } from "@agentprint/database";
import { viewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { ProfileView } from "@/components/profile-view";
import { PrivateProfileView } from "@/components/private-profile-view";
import { ProfileFriendAction } from "@/components/profile-friend-action";

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
  const identity = await getProfileIdentity(handle);
  if (!identity) notFound();
  const isOwnProfile = current?.handle === identity.handle;
  const [data, friendState] = await Promise.all([
    getProfile(handle, current?.id),
    current && !isOwnProfile ? findFriendCandidate(current.id, handle) : null
  ]);
  const friendAction = !isOwnProfile ? (
    <ProfileFriendAction
      handle={identity.handle}
      signedIn={Boolean(current)}
      initialState={current ? friendState : undefined}
    />
  ) : null;
  return (
    <>
      <SiteHeader current={current} variant="marketing" search />
      {data ? (
        <ProfileView data={data} preview={!data.profile.is_public} friendAction={friendAction} />
      ) : (
        <PrivateProfileView identity={identity} friendAction={friendAction} />
      )}
    </>
  );
}
