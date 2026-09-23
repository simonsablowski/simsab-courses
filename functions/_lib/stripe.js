/**
 * Shared helper for making GET requests to the Stripe API.
 *
 * @param {object} env - Cloudflare environment object
 * @param {string} path - API endpoint path (e.g. '/v1/products?active=true')
 * @returns {Promise<any>}
 */
export async function stripeGet(env, path) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const response = await fetch(`https://api.stripe.com${path}`, {
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `Stripe GET request to ${path} failed with status ${response.status}`
    );
  }

  return data;
}

/**
 * Shared helper for making POST requests to the Stripe API.
 *
 * @param {object} env - Cloudflare environment object
 * @param {string} path - API endpoint path (e.g. '/v1/products/prod_123')
 * @param {URLSearchParams|object} body - Request body payload
 * @returns {Promise<any>}
 */
export async function stripePost(env, path, body) {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  const payload =
    body instanceof URLSearchParams
      ? body
      : new URLSearchParams(
          Object.entries(body).map(([k, v]) => [k, String(v)])
        );

  const response = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error?.message ||
        `Stripe POST request to ${path} failed with status ${response.status}`
    );
  }

  return data;
}
