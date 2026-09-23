import { verifyStripeSignature } from "../_lib/stripeSig.js";
import { stripeGet, stripePost } from "../_lib/stripe.js";

export async function onRequestPost({ request, env }) {
  const rawBody = await request.text();
  const signature = request.headers.get("Stripe-Signature") || "";

  const valid = await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return new Response("Invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);

  if (event.type !== "checkout.session.completed") {
    // Acknowledge everything else so Stripe stops retrying it.
    return new Response("ok", { status: 200 });
  }

  try {
    const session = event.data.object;
    const stripeProductId = session.metadata?.stripe_product_id;

    if (stripeProductId && env.STRIPE_SECRET_KEY) {
      // Fetch current Stripe product to inspect metadata
      const product = await stripeGet(env, `/v1/products/${stripeProductId}`);
      const metadata = product.metadata || {};

      const maxSeats = Number(metadata.max_seats || 0);
      const currentSeatsTaken = Number(metadata.seats_taken || 0);
      const newSeatsTaken = currentSeatsTaken + 1;

      // Prepare metadata updates
      const updatePayload = {
        "metadata[seats_taken]": String(newSeatsTaken),
      };

      // Automatically close status if max_seats has been reached
      if (maxSeats > 0 && newSeatsTaken >= maxSeats) {
        updatePayload["metadata[status]"] = "closed";
      }

      // Update metadata in Stripe
      await stripePost(env, `/v1/products/${stripeProductId}`, updatePayload);

      // Invalidate KV cache so /api/courses immediately reflects the update
      if (env.COURSES_CACHE) {
        await env.COURSES_CACHE.delete("courses");
      }
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    return new Response(`Webhook handler error: ${err}`, { status: 500 });
  }
}
