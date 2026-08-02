import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@agentprint/database";

export const SESSION_COOKIE = "pm_session";

export async function viewer() {
  const jar = await cookies();
  return getViewer(jar.get(SESSION_COOKIE)?.value);
}

export async function requireViewer(options?: { allowIncomplete?: boolean }) {
  const current = await viewer();
  if (!current) redirect("/login");
  if (!options?.allowIncomplete && !current.onboarding_complete) redirect("/onboarding");
  return current;
}

export async function apiViewer() {
  const jar = await cookies();
  return getViewer(jar.get(SESSION_COOKIE)?.value);
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  };
}
