/**
 * Security headers on every response the Worker serves (pages and APIs). Static files are served
 * by Cloudflare before the Worker runs and get the same headers from `public/_headers`;
 * security-headers.test.ts keeps the two in step.
 *
 * The policy allows exactly what the app loads: its own scripts, styles and assets, Google Fonts,
 * and Cloudflare Turnstile (script and frame). Inline scripts stay allowed because the server
 * render inlines its hydration data; everything else (other origins, plugins, framing, base
 * changes, form posts elsewhere) is blocked. Dev skips the policy so Vite's hot reload works.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "frame-src https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export const SECURITY_HEADERS: Record<string, string> = {
  "content-security-policy": CONTENT_SECURITY_POLICY,
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "cross-origin-opener-policy": "same-origin",
};

/** The response with the security headers added (an existing header of the same name is kept). */
export function withSecurityHeaders(response: Response, production: boolean): Response {
  const entries = Object.entries(SECURITY_HEADERS).filter(
    ([name]) =>
      production || (name !== "content-security-policy" && name !== "strict-transport-security"),
  );
  let target = response;
  try {
    for (const [name, value] of entries)
      if (!target.headers.has(name)) target.headers.set(name, value);
  } catch {
    // Immutable headers (a response passed through from fetch): copy it, keeping the body stream.
    target = new Response(response.body, response);
    for (const [name, value] of entries)
      if (!target.headers.has(name)) target.headers.set(name, value);
  }
  return target;
}
