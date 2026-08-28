import "server-only";

import { AppError } from "@/lib/server/errors";

function expectedOrigin(request: Request): string {
  const configured = process.env.MOTOMEMORY_APP_ORIGIN?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      throw new AppError(
        "INVALID_CONFIGURATION",
        "The application origin is invalid on the server.",
        503,
      );
    }
  }

  return new URL(request.url).origin;
}

/** Require browser mutation metadata to identify this deployment's origin. */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin")?.trim() || null;
  const referer = request.headers.get("referer")?.trim() || null;
  let suppliedOrigin = origin;

  if (!suppliedOrigin && referer) {
    try {
      suppliedOrigin = new URL(referer).origin;
    } catch {
      throw new AppError(
        "CSRF_FORBIDDEN",
        "This mutation request did not come from the application origin.",
        403,
      );
    }
  }

  // Browser requests in production must carry Origin or Referer. Local and
  // unit callers may omit both so the private API remains scriptable while the
  // deployment policy is still fail-closed for browsers.
  if (!suppliedOrigin && process.env.NODE_ENV === "production") {
    throw new AppError(
      "CSRF_FORBIDDEN",
      "This mutation request did not identify the application origin.",
      403,
    );
  }

  if (suppliedOrigin && suppliedOrigin !== expectedOrigin(request)) {
    throw new AppError(
      "CSRF_FORBIDDEN",
      "This mutation request did not come from the application origin.",
      403,
    );
  }
}
