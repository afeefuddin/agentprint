import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findFriendCandidate, getProfile, getProfileIdentity } from "@agentprint/database";
import { viewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { ProfileView } from "@/components/profile-view";
import { PrivateProfileView } from "@/components/private-profile-view";
import { ProfileFriendAction } from "@/components/profile-friend-action";
import { absoluteUrl } from "@/lib/site";

export async function generateMetadata({
  params
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const identity = await getProfileIdentity(handle);
  if (!identity) {
    return {
      title: "Profile not found",
      robots: { index: false, follow: false }
    };
  }
  const title = `${identity.displayName} (@${identity.handle}) – Coding agent activity`;
  const description = `${identity.displayName}'s coding agent activity profile on Agentprint.`;
  return {
    title: { absolute: title },
    description,
    alternates: identity.isPublic ? { canonical: absoluteUrl(`/${identity.handle}`) } : undefined,
    robots: identity.isPublic ? undefined : { index: false, follow: false },
    openGraph: identity.isPublic ? {
      type: "profile",
      url: absoluteUrl(`/${identity.handle}`),
      title,
      description
    } : undefined,
    twitter: identity.isPublic ? { card: "summary_large_image", title, description } : undefined
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
