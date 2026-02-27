/**
 * Shared helpers for integration tests.
 *
 * Integration tests call the REAL deployed Supabase functions.
 * Configure via environment variables (copy supabase/.env.test.example → supabase/.env.test
 * and load it before running: set -a && source .env.test && set +a).
 */

export const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
export const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
export const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
export const ADMIN_JWT = Deno.env.get("TEST_ADMIN_JWT") ?? "";
export const USER_JWT = Deno.env.get("TEST_USER_JWT") ?? "";
export const ONECODE_WEBHOOK_SECRET = Deno.env.get("ONECODE_WEBHOOK_SECRET") ?? "";

/** Returns true when the minimum integration test env vars are present */
export function integrationEnvReady(): boolean {
  return Boolean(SUPABASE_URL && ANON_KEY);
}

/** Returns true when admin credentials are configured */
export function adminEnvReady(): boolean {
  return integrationEnvReady() && Boolean(ADMIN_JWT);
}

/** Builds the full URL for a given edge function */
export function fnUrl(name: string): string {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

/** POST helper with JSON body */
export async function postJson(
  name: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return await fetch(fnUrl(name), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

/** GET helper */
export async function getReq(
  name: string,
  headers: Record<string, string> = {},
): Promise<Response> {
  return await fetch(fnUrl(name), { method: "GET", headers });
}

/** Authorization header using a Bearer JWT */
export function bearerAuth(jwt: string): Record<string, string> {
  return { Authorization: `Bearer ${jwt}` };
}
