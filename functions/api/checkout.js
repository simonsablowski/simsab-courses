import { json } from "../_lib/http.js";
import { stripeGet, stripePost } from "../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  try {
    // Safety guard while the checkout flow is still being developed.
    // Remove this deliberately when you are ready to accept live payments.
    if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
      return json(
        { error: "Checkout is currently restricted to Stripe test mode." },
        500
      );
    }

    const { course_slug, cohort_id, currency } = await request.json();

    if (!course_slug || !cohort_id || !["eur", "usd"].includes(currency)) {
      return json(
        { error: "Missing or invalid course_slug, cohort_id, or currency" },
        400
      );
    }

    // Read directly from Stripe rather than using the cached /api/courses
    // response, so checkout validates the current cohort configuration.
    const products = await stripeGet(
      env,
      "/v1/products?active=true&limit=100"
    );

    const cohort = products.data.find((product) => {
      const metadata = product.metadata || {};

      return (
        metadata.course_slug === course_slug &&
        metadata.cohort_id === cohort_id
      );
    });

    if (!cohort || cohort.metadata?.status !== "open") {
      return json(
        { error: "This cohort is not open for enrollment" },
        404
      );
    }

    const maxSeats = Number(cohort.metadata.max_seats || 0);
    const seatsTaken = Number(cohort.metadata.seats_taken || 0);
    const seatsLeft = Math.max(0, maxSeats - seatsTaken);

    if (seatsLeft <= 0) {
      return json({ error: "This cohort is full" }, 409);
    }

    // Find the active one-time prices attached to this Stripe Product.
    const prices = await stripeGet(
      env,
      `/v1/prices?active=true&type=one_time&limit=100&product=${encodeURIComponent(cohort.id)}`
    );

    const price = prices.data.find(
      (p) => p.currency === currency
    );

    if (!price) {
      return json(
        {
          error: `No ${currency.toUpperCase()} price configured for this cohort`,
        },
        500
      );
    }

    const origin = new URL(request.url).origin;

    const params = new URLSearchParams({
      mode: "payment",

      "line_items[0][price]": price.id,
      "line_items[0][quantity]": "1",

      allow_promotion_codes: "true",

      success_url:
        `${origin}/success.html?session_id={CHECKOUT_SESSION_ID}`,

      cancel_url:
        `${origin}/${encodeURIComponent(course_slug)}`,

      "metadata[course_slug]": course_slug,
      "metadata[cohort_id]": cohort_id,
      "metadata[stripe_product_id]": cohort.id,

      "custom_fields[0][key]": "first_name",
      "custom_fields[0][label][type]": "custom",
      "custom_fields[0][label][custom]": "First name",
      "custom_fields[0][type]": "text",

      "custom_fields[1][key]": "last_name",
      "custom_fields[1][label][type]": "custom",
      "custom_fields[1][label][custom]": "Last name",
      "custom_fields[1][type]": "text",
    });

    const session = await stripePost(env, "/v1/checkout/sessions", params);

    return json({ url: session.url });
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
}
