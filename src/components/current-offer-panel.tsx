import { useEffect, useState } from "react";
import { getPartCurrentOffer } from "@/lib/apiClient";
import { formatUsdMinorUnits, formatObservationDate } from "@/lib/price-trend";
import { isSafeExternalUrl } from "@/lib/product-trust";
import { trackAnalyticsEvent } from "@/lib/analytics";
import type { CurrentOfferApiResponse } from "@/types/current-offer";

export function CurrentOfferPanel({ partId }: { partId: string }) {
  const [state, setState] = useState<{ key: string; response?: CurrentOfferApiResponse; failed?: boolean }>();
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setState(undefined);
    void getPartCurrentOffer(partId).then((response) => { if (active) setState({ key: partId, response }); }).catch(() => { if (active) setState({ key: partId, failed: true }); });
    return () => { active = false; };
  }, [partId, retry]);
  const current = state?.key === partId ? state : undefined;
  const response = current?.response;
  const offer = response?.status === "success" ? response.offer : null;
  const fresh = offer && Date.parse(offer.expiresAt) > Date.now();
  return <section className="current-offer-panel" aria-label="Current retailer offer" aria-live="polite">
    <strong>Current retailer price</strong>
    {!current ? <p>Checking retailer pricing…</p> : offer && fresh ? <>
      <p className="offer-amount">{formatUsdMinorUnits(offer.itemPriceMinor)} <small>{offer.retailerName} · {offer.availability.replaceAll("_", " ")}</small></p>
      <p>Shipping {offer.shippingPriceMinor === null ? "unknown" : formatUsdMinorUnits(offer.shippingPriceMinor)} · tax extra. Checked {formatObservationDate(offer.fetchedAt)}.</p>
      {isSafeExternalUrl(offer.productUrl) && <a className="outline-button" href={offer.productUrl} target="_blank" rel="noopener noreferrer" onClick={() => trackAnalyticsEvent("affiliate_link_opened", { part_id: partId, source: "current_offer", retailer: offer.retailerName })}>Check at {offer.retailerName} ↗</a>}
      <p>{offer.attribution}</p>
    </> : <p>{current.failed || response?.status === "error" ? "Retailer pricing could not be loaded." : offer ? "This quote has expired. Refresh to check again." : "A current retailer quote is not available for this exact item yet."} Catalog estimates remain separate from live quotes.</p>}
    {current && (!offer || !fresh) && <button className="text-button" onClick={() => setRetry((value) => value + 1)}>Check again</button>}
  </section>;
}
