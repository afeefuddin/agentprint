import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export async function parseJson<T>(request: Request, schema: ZodType<T>) {
  try {
    const body = await request.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      return {
        data: null,
        response: NextResponse.json(
          {
            error: "invalid_request",
            message: "The request did not match the expected contract.",
            issues: result.error.issues.map((issue) => ({
              path: issue.path.join("."),
              message: issue.message
            }))
          },
          { status: 400 }
        )
      };
    }
    return { data: result.data, response: null };
  } catch {
    return {
      data: null,
      response: NextResponse.json(
        { error: "invalid_json", message: "A JSON request body is required." },
        { status: 400 }
      )
    };
  }
}

export function conflict(message: string) {
  return NextResponse.json({ error: "conflict", message }, { status: 409 });
}

export function unauthorized(message = "Authentication is required.") {
  return NextResponse.json({ error: "unauthorized", message }, { status: 401 });
}

export function notFound(message = "The requested resource was not found.") {
  return NextResponse.json({ error: "not_found", message }, { status: 404 });
}

export function requestUrl(request: Request, path: string) {
  const appUrl = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) return new URL(path, appUrl);

  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  const protocol = headers.get("x-forwarded-proto") ?? (
    host?.startsWith("localhost") || host?.startsWith("127.") ? "http" : "https"
  );
  return new URL(path, host ? `${protocol}://${host}` : request.url);
}

export function clientAddress(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "local";
}

export function tooManyRequests() {
  return NextResponse.json(
    { error: "rate_limited", message: "Too many attempts. Please wait and try again." },
    { status: 429, headers: { "Retry-After": "60" } }
  );
}
