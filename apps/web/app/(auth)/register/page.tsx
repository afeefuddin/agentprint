import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { viewer } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { OAuthButtons } from "@/components/oauth-buttons";

export const metadata: Metadata = { title: "Create your profile" };

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const current = await viewer();
  if (current) redirect(current.onboarding_complete ? "/dashboard" : "/onboarding");
  return (
    <main id="main" className="auth-layout">
      <section className="auth-panel">
        <Brand />
        <div className="auth-copy">
          <span className="eyebrow">Private by default</span>
          <h1>Start your<br /><em>agent record.</em></h1>
          <p>Continue with an account you trust, then choose your name and public handle. Nothing is published without your approval.</p>
        </div>
        <OAuthButtons mode="register" oauthError={error} />
        <p className="auth-legal">By continuing, you agree to the Terms and acknowledge the Privacy Specification.</p>
      </section>
      <aside className="auth-art" aria-hidden="true">
        <div className="auth-orbit orbit-one" /><div className="auth-orbit orbit-two" />
        <div className="auth-trace">
          <span>Local trace</span>
          <div>{Array.from({ length: 40 }, (_, i) => <i key={i} data-on={(i * 7) % 11 > 3 || undefined} />)}</div>
          <b>encrypted sync / content excluded</b>
        </div>
        <div className="auth-assurance"><ShieldCheck size={17} /><span>No prompts<br />No code<br />No paths</span></div>
      </aside>
    </main>
  );
}
