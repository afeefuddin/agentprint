import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";
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
    <main id="main" className="min-h-screen bg-canvas desktop:grid desktop:h-dvh desktop:grid-cols-[minmax(420px,.82fr)_minmax(620px,1.18fr)] desktop:overflow-hidden">
      <section className="relative flex min-h-screen items-center px-[clamp(24px,7vw,108px)] py-24">
        <header className="absolute left-[clamp(24px,7vw,108px)] top-8">
          <Brand />
        </header>

        <div className="mx-auto w-full max-w-[440px]">
          <h1 className="text-4xl font-normal leading-tight text-ink-strong">Sign in</h1>
          <OAuthButtons nextPath={nextPath} oauthError={error} />
        </div>
      </section>

      <aside
        className="relative hidden overflow-hidden rounded-md border border-line-strong bg-canvas-deep desktop:m-3 desktop:ml-0 desktop:block"
        aria-hidden="true"
        data-testid="login-artwork"
      >
        <Image
          src="/auth/agentprint-trace-field.webp"
          alt=""
          fill
          priority
          sizes="58vw"
          className="object-cover object-center"
        />
      </aside>
    </main>
  );
}
