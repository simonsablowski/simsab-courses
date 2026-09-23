// Verifies a Stripe-Signature header against the raw request body.
// Stripe signs `${timestamp}.${rawBody}` with HMAC-SHA256 using the
// webhook signing secret. See https://stripe.com/docs/webhooks#verify-manually

export async function verifyStripeSignature(rawBody, signatureHeader, secret) {
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("="))
  );
  const timestamp = parts.t;
  const expectedSig = parts.v1;
  if (!timestamp || !expectedSig) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`)
  );
  const computedSig = [...new Uint8Array(signed)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Reject old timestamps (replay protection) — 5 minute tolerance, same as Stripe's own SDKs.
  const age = Date.now() / 1000 - Number(timestamp);
  if (age > 300) return false;

  return timingSafeEqual(computedSig, expectedSig);
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
