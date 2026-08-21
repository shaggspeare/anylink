import { fetchHtml } from "./fetch-page";
import { parseHtml } from "./parse-page";

export type PriceCheckResult = { price: number; currency: string; inStock?: boolean } | null;

/** Re-fetches a product page for just its current price — reuses the full parser
 * (JSON-LD is cheap to re-derive) rather than hand-rolling a slimmer extractor. */
export async function checkProductPrice(url: string): Promise<PriceCheckResult> {
  try {
    const { html, finalUrl } = await fetchHtml(url);
    const result = parseHtml(html, finalUrl);
    if (result.product?.price === undefined) return null;
    return {
      price: result.product.price,
      currency: result.product.currency,
      inStock: result.product.inStock,
    };
  } catch {
    return null;
  }
}
