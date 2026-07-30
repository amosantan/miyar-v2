import type { RequestHandler } from "express";

export const PUBLIC_SHARE_HEADERS = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
} as const;

export function isPublicShareTrpcRequest(path: string): boolean {
  const withoutQuery = path.split("?", 1)[0] ?? "";
  const marker = "/api/trpc/";
  const markerIndex = withoutQuery.indexOf(marker);
  if (markerIndex < 0) return false;
  const rawSuffix = withoutQuery.slice(markerIndex + marker.length);
  let decodedSuffix = rawSuffix;
  try {
    decodedSuffix = decodeURIComponent(rawSuffix);
  } catch {
    // Preserve the raw suffix so malformed paths still receive deterministic handling.
  }
  const procedures = decodedSuffix.split(",");
  return procedures.some(
    procedure =>
      procedure === "design.resolveShareLink" ||
      procedure === "reportShare.resolve"
  );
}

export const publicShareHeaders: RequestHandler = (req, res, next) => {
  if (isPublicShareTrpcRequest(req.originalUrl || req.url)) {
    for (const [name, value] of Object.entries(PUBLIC_SHARE_HEADERS)) {
      res.setHeader(name, value);
    }
  }
  next();
};
