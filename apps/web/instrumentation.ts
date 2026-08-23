import type { Instrumentation } from "next";
import { capturePostHogException } from "@/lib/posthog-server";

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context
) => {
  await capturePostHogException(error, {
    path: request.path.split(/[?#]/, 1)[0],
    method: request.method,
    router_kind: context.routerKind,
    route_type: context.routeType,
    render_source: context.renderSource ?? "unknown"
  });
};
