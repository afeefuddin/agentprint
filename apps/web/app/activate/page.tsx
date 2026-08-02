import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { viewer } from "@/lib/auth";
import { Brand } from "@/components/brand";
import { ActivateForm } from "@/components/activate-form";

export const metadata: Metadata = { title: "Connect device" };

export default async function ActivatePage({
  searchParams
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  if (!(await viewer())) {
    const { code } = await searchParams;
    redirect(`/login?next=${encodeURIComponent(`/activate${code ? `?code=${code}` : ""}`)}`);
  }
  const { code } = await searchParams;
  return (
    <main id="main" className="activate-layout">
      <Brand />
      <ActivateForm initialCode={code} />
      <p className="activation-footer">One-time codes expire after 10 minutes.</p>
    </main>
  );
}
