import type { Metadata } from "next";
import { listFriendships } from "@agentprint/database";
import { FriendsWorkspace } from "@/components/friends-workspace";
import { SiteHeader } from "@/components/site-header";
import { requireViewer } from "@/lib/auth";

export const metadata: Metadata = { title: "Friends" };

export default async function FriendsPage() {
  const current = await requireViewer();
  const friendships = await listFriendships(current.id);

  return (
    <>
      <SiteHeader current={current} />
      <main id="main" className="friends-main">
        <div className="shell">
          <FriendsWorkspace
            initialFriendships={friendships}
            initialComparisonSharing={current.friends_can_compare}
          />
        </div>
      </main>
    </>
  );
}
