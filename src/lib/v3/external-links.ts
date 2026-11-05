/**
 * The only sites the v3 app links out to: the manufacturers whose pages the catalog cites, the
 * retailer whose search the catalog uses, the search used for an AI model guess, and the policy
 * pages the privacy page cites. A link to any other host is shown as text, not a link, so a bad
 * catalog entry or a crafted saved build cannot send people to an arbitrary site. Adding a
 * manufacturer to the catalog means adding its domain here (external-links.test.ts checks it).
 */
export const EXTERNAL_LINK_DOMAINS = [
  "amd.com",
  "arctic.de",
  "asus.com",
  "bequiet.com",
  "corsair.com",
  "deepcool.com",
  "gigabyte.com",
  "hyte.com",
  "lian-li.com",
  "montechpc.com",
  "msi.com",
  "nvidia.com",
  "nzxt.com",
  "phanteks.com",
  "newegg.com",
  "google.com",
  "openai.com",
  "cloudflare.com",
] as const;

/** `value` if it is an https link to an allowed site (or a subdomain of one), else null. */
export function allowedExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
  const host = url.hostname.toLowerCase();
  return EXTERNAL_LINK_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`))
    ? url.href
    : null;
}

/** Attributes for an outbound link: a new tab, no opener, no referrer, no endorsement. */
export const externalLinkProps = {
  target: "_blank",
  rel: "noopener noreferrer nofollow",
} as const;
