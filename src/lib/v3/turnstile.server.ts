import { ImageAnalysisError } from "@/lib/v3/image-analysis.server";

/**
 * Cloudflare Turnstile check on Analyze (docs/DEPLOY.md, Stage 2). Enforced only when
 * `TURNSTILE_SECRET_KEY` is set (a Worker secret); the browser widget appears when the public
 * `VITE_TURNSTILE_SITE_KEY` is set. The token travels in the `x-turnstile-token` header.
 */
export const TURNSTILE_HEADER = "x-turnstile-token";
const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export class TurnstileError extends ImageAnalysisError {
  constructor() {
    super(
      "The human check did not pass or has expired. Complete it again, then retry.",
      403,
      "TURNSTILE_FAILED",
    );
    this.name = "TurnstileError";
  }
}

export async function verifyTurnstile(
  request: Request,
  secret: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  if (!secret) return;
  const token = request.headers.get(TURNSTILE_HEADER);
  if (!token || token.length > 2048) throw new TurnstileError();
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) body.append("remoteip", ip);
  try {
    const response = await fetcher(VERIFY_URL, { method: "POST", body });
    const result = (await response.json()) as { success?: boolean };
    if (result.success === true) return;
  } catch {
    // An unreachable verifier fails closed, like a failed check.
  }
  throw new TurnstileError();
}
