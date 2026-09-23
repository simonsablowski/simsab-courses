import { json } from "../_lib/http.js";
import { stripeGet } from "../_lib/stripe.js";

const CACHE_KEY = "courses";
const CACHE_TTL_SECONDS = 300;

export async function onRequestGet({ env }) {
  try {
    const cached = await env.COURSES_CACHE.get(CACHE_KEY, "json");
    if (cached) {
      return json(cached);
    }

    // Batch products and prices requests in parallel (2 total requests instead of N+1)
    const [productsRes, pricesRes] = await Promise.all([
      stripeGet(env, "/v1/products?active=true&limit=100"),
      stripeGet(env, "/v1/prices?active=true&type=one_time&limit=100"),
    ]);

    // Group active prices by product ID in memory
    const pricesByProduct = new Map();
    for (const price of pricesRes.data || []) {
      const prodId = typeof price.product === "string" ? price.product : price.product?.id;
      if (!prodId) continue;
      if (!pricesByProduct.has(prodId)) {
        pricesByProduct.set(prodId, []);
      }
      pricesByProduct.get(prodId).push(price);
    }

    const pub = [];

    for (const product of productsRes.data || []) {
      const metadata = product.metadata || {};

      // Ignore Stripe products that are not course cohorts.
      if (!metadata.course_slug || !metadata.cohort_id) {
        continue;
      }

      // Preserve existing behaviour of only returning open cohorts.
      if (metadata.status !== "open") {
        continue;
      }

      const prices = pricesByProduct.get(product.id) || [];
      const eurPrice = prices.find((p) => p.currency === "eur");
      const usdPrice = prices.find((p) => p.currency === "usd");

      const maxSeats = Number(metadata.max_seats || 0);
      const seatsTaken = Number(metadata.seats_taken || 0);

      pub.push({
        course_slug: metadata.course_slug,
        course_name: product.name,
        description: product.description || "",
        highlights: (metadata.highlights || "")
          .split("|")
          .map((h) => h.trim())
          .filter(Boolean),
        flagship: metadata.flagship === "true",
        cohort_id: metadata.cohort_id,
        start_date: metadata.start_date,
        end_date: metadata.end_date,
        seats_left: Math.max(0, maxSeats - seatsTaken),
        price_eur: eurPrice ? eurPrice.unit_amount / 100 : 0,
        price_usd: usdPrice ? usdPrice.unit_amount / 100 : 0,
      });
    }

    await env.COURSES_CACHE.put(CACHE_KEY, JSON.stringify(pub), {
      expirationTtl: CACHE_TTL_SECONDS,
    });

    return json(pub);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
