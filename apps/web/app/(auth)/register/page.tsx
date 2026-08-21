import { redirect } from "next/navigation";

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const query = new URLSearchParams();
  if (next?.startsWith("/") && !next.startsWith("//")) query.set("next", next);
  if (error) query.set("error", error);
  redirect(`/login${query.size ? `?${query}` : ""}`);
}
