/**
 * Integration tests: reset-user-password & create-admin
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_ANON_KEY, TEST_ADMIN_JWT (optional: TEST_USER_JWT)
 * Run: deno task test:integration  (from supabase/ directory)
 */

import {
  assertEquals,
  assert,
  integrationEnvReady,
  adminEnvReady,
  postJson,
  bearerAuth,
  ADMIN_JWT,
  USER_JWT,
} from "./_helpers.ts";

// ─────────────────────────────────────────────────────────────
// reset-user-password
// ─────────────────────────────────────────────────────────────

Deno.test({
  name: "reset-user-password — no token → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson("reset-user-password", {
      user_id: "00000000-0000-0000-0000-000000000000",
      new_password: "test1234",
    });
    assertEquals(res.status, 401);
    const body = await res.json();
    assert(body.error, "Expected error field in response");
  },
});

Deno.test({
  name: "reset-user-password — invalid token → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson(
      "reset-user-password",
      { user_id: "00000000-0000-0000-0000-000000000000", new_password: "test1234" },
      bearerAuth("invalid.jwt.token"),
    );
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "reset-user-password — non-admin token → 403",
  ignore: !integrationEnvReady() || !USER_JWT,
  async fn() {
    const res = await postJson(
      "reset-user-password",
      { user_id: "00000000-0000-0000-0000-000000000000", new_password: "test1234" },
      bearerAuth(USER_JWT),
    );
    assertEquals(res.status, 403);
    const body = await res.json();
    assert(body.error, "Expected error field in response");
  },
});

Deno.test({
  name: "reset-user-password — admin token + short password → 400",
  ignore: !adminEnvReady(),
  async fn() {
    const res = await postJson(
      "reset-user-password",
      { user_id: "00000000-0000-0000-0000-000000000000", new_password: "abc" },
      bearerAuth(ADMIN_JWT),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assert(body.error, "Expected error field for short password");
  },
});

Deno.test({
  name: "reset-user-password — admin token + missing user_id → 400 or 500",
  ignore: !adminEnvReady(),
  async fn() {
    const res = await postJson(
      "reset-user-password",
      { new_password: "validpassword" },
      bearerAuth(ADMIN_JWT),
    );
    assert(
      res.status === 400 || res.status === 500,
      `Expected 400 or 500, got ${res.status}`,
    );
  },
});

// ─────────────────────────────────────────────────────────────
// create-admin
// ─────────────────────────────────────────────────────────────

Deno.test({
  name: "create-admin — no token → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson("create-admin", {
      email: "test@example.com",
      password: "testpassword",
    });
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "create-admin — invalid token → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson(
      "create-admin",
      { email: "test@example.com", password: "testpassword" },
      bearerAuth("bad.token.here"),
    );
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "create-admin — non-admin token → 403",
  ignore: !integrationEnvReady() || !USER_JWT,
  async fn() {
    const res = await postJson(
      "create-admin",
      { email: "test@example.com", password: "testpassword" },
      bearerAuth(USER_JWT),
    );
    assertEquals(res.status, 403);
  },
});

Deno.test({
  name: "create-admin — admin token + missing email → error",
  ignore: !adminEnvReady(),
  async fn() {
    const res = await postJson(
      "create-admin",
      { password: "testpassword" },
      bearerAuth(ADMIN_JWT),
    );
    assert(
      res.status >= 400,
      `Expected error status, got ${res.status}`,
    );
  },
});
