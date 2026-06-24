import { getServerConfig } from "@/lib/config.server";
import type {
  CreateCheckoutSessionRequest,
  CreateCheckoutSessionResponse,
} from "@/types/monetization";

type StripeCheckoutSessionPayload = {
  id?: string;
  url?: string;
  error?: {
    message?: string;
  };
};

export function isStripeCheckoutConfigured() {
  const config = getServerConfig();
  return Boolean(config.stripeSecretKey && config.stripeBuildProPriceId);
}

export async function createStripeCheckoutSession({
  plan,
  buildId,
  userId,
}: CreateCheckoutSessionRequest): Promise<CreateCheckoutSessionResponse & { checkoutSessionId?: string }> {
  const config = getServerConfig();

  if (plan !== "build_pro") {
    return {
      fallbackUsed: true,
      message: "Only Build Pro checkout is supported right now.",
    };
  }

  if (!config.stripeSecretKey || !config.stripeBuildProPriceId) {
    return {
      fallbackUsed: true,
      message:
        "Local dev checkout is using the mock Build Pro unlock because Stripe keys are not configured.",
    };
  }

  const appUrl = (config.publicAppUrl ?? "http://localhost:5173").replace(/\/$/, "");
  const params = new URLSearchParams({
    mode: "payment",
    "line_items[0][price]": config.stripeBuildProPriceId,
    "line_items[0][quantity]": "1",
    success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/checkout/cancel`,
    "metadata[plan]": plan,
    "metadata[userId]": userId ?? "mock-user",
    "metadata[buildId]": buildId ?? "mock-build",
  });

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.stripeSecretKey}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: params,
  });

  const payload = (await response.json()) as StripeCheckoutSessionPayload;

  if (!response.ok || !payload.url) {
    return {
      fallbackUsed: true,
      message:
        payload.error?.message ??
        "Stripe Checkout could not be created, so this session is using the mock Build Pro unlock.",
    };
  }

  return {
    checkoutUrl: payload.url,
    checkoutSessionId: payload.id,
    fallbackUsed: false,
    message: "Stripe Checkout session created.",
  };
}
