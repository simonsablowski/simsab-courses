/**
 * Helper function for JSON responses in Cloudflare Functions.
 *
 * @param {any} body - Response payload to stringify as JSON
 * @param {number} [status=200] - HTTP status code
 * @param {HeadersInit} [headers={}] - Additional response headers
 * @returns {Response}
 */
export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}
