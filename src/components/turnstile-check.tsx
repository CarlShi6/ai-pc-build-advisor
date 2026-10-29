import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile human check before Analyze (docs/DEPLOY.md, Stage 2). Shown only when the
 * public site key `VITE_TURNSTILE_SITE_KEY` is set; the server checks the token when its
 * `TURNSTILE_SECRET_KEY` is set. A token works once, so the widget resets after each use.
 */
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptLoad: Promise<TurnstileApi> | undefined;

function loadTurnstile() {
  scriptLoad ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error()));
    script.onerror = () => reject(new Error("The human check could not load."));
    document.head.appendChild(script);
  });
  return scriptLoad;
}

export function TurnstileCheck({
  siteKey,
  resetKey,
  onToken,
}: {
  siteKey: string;
  /** Changing it resets the widget for a fresh token. */
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const tokenCallback = useRef(onToken);
  tokenCallback.current = onToken;

  useEffect(() => {
    let active = true;
    void loadTurnstile()
      .then((api) => {
        if (!active || !container.current) return;
        const id = api.render(container.current, {
          sitekey: siteKey,
          callback: (token) => tokenCallback.current(token),
          "expired-callback": () => tokenCallback.current(null),
          "error-callback": () => tokenCallback.current(null),
        });
        widget.current = { api, id };
      })
      .catch(() => tokenCallback.current(null));
    return () => {
      active = false;
      if (widget.current) widget.current.api.remove(widget.current.id);
      widget.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey === 0 || !widget.current) return;
    tokenCallback.current(null);
    widget.current.api.reset(widget.current.id);
  }, [resetKey]);

  return <div className="v3-turnstile" ref={container} aria-label="Human check" />;
}
