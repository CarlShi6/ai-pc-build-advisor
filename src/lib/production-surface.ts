/**
 * The first public deployment serves only the v3 app (docs/DEPLOY.md, Stage 2). In a production
 * build the pre-v3 pages and every API the v3 app does not call answer 404, so Stripe, sign-in,
 * the advisor chat and the legacy workspace are unreachable. Dev and tests keep them all.
 */
const legacyPages = [
  "/build",
  "/cart",
  "/checkout",
  "/compare",
  "/consult",
  "/dashboard",
  "/legacy-workspace",
];

/** The APIs the v3 app calls: photo analysis, product analytics and Describe's recommendation. */
const v3Apis = ["/api/image-analyses", "/api/analytics/events", "/api/build/recommend"];

const normalize = (pathname: string) => pathname.replace(/\/+$/, "").toLowerCase() || "/";

const within = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

export function isLegacyPage(pathname: string) {
  const path = normalize(pathname);
  return legacyPages.some((base) => within(path, base));
}

export function hiddenInProduction(pathname: string) {
  const path = normalize(pathname);
  if (within(path, "/api")) return !v3Apis.includes(path);
  return isLegacyPage(path);
}

export function notFoundResponse(pathname: string) {
  if (within(normalize(pathname), "/api"))
    return Response.json(
      { error: { code: "NOT_FOUND", message: "Not found." } },
      { status: 404, headers: { "cache-control": "no-store" } },
    );
  return new Response(
    '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found · AIPC</title></head><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 16px;line-height:1.6"><h1>Page not found</h1><p>This page is not part of AIPC.</p><p><a href="/">Go to the start page</a></p></body></html>',
    { status: 404, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}
