import { getServerConfig } from "@/lib/config.server";
import { createBestBuyProvider } from "@/lib/pricing/best-buy-provider.server";
import type { RetailPriceProvider } from "@/types/current-offer";

let provider: RetailPriceProvider | null = null;
let providerConfiguration = "";

export function getRetailPriceProvider() {
  const config = getServerConfig();
  const enabled = !config.priceProvider || config.priceProvider === "bestbuy";
  const configuration = `${enabled}:${config.bestBuyApiKey ?? ""}`;

  if (!provider || providerConfiguration !== configuration) {
    provider = createBestBuyProvider({ apiKey: enabled ? config.bestBuyApiKey : undefined });
    providerConfiguration = configuration;
  }

  return provider;
}
