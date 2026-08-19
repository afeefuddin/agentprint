import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Activity } from "lucide-react";
import { viewer } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { OAuthButtons } from "@/components/oauth-buttons";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const nextPath = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;
  const current = await viewer();
  if (current) redirect(current.onboarding_complete ? nextPath ?? `/${current.handle}` : "/onboarding");
  return (
    <main id="main" className="auth-layout">
      <section className="auth-panel">
        <Brand />
        <div className="auth-copy">
          <span className="eyebrow">Welcome back</span>
          <h1>Return to<br /><em>your trace.</em></h1>
          <p>Review sync health, inspect your private activity, and control what appears on your public profile.</p>
        </div>
        <OAuthButtons mode="login" nextPath={nextPath} oauthError={error} />
      </section>
      <aside className="auth-art auth-art-login" aria-hidden="true">
        <div className="login-readout"><Activity size={18} /><span>Last 7 days</span><b>2.84M</b><em>tokens synced</em></div>
        <div className="auth-wave">{Array.from({ length: 48 }, (_, i) => <i key={i} style={{ height: `${14 + ((i * 29) % 70)}%` }} />)}</div>
      </aside>
    </main>
  );
}
