/**
 * Integration tests: sync-acessorias
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_ANON_KEY
 *   + TEST_ADMIN_JWT for POST tests
 * Run: deno task test:integration  (from supabase/ directory)
 */

import { assertEquals, assert } from "@std/assert";
import {
  integrationEnvReady,
  adminEnvReady,
  postJson,
  getReq,
  bearerAuth,
  ADMIN_JWT,
  USER_JWT,
} from "./_helpers.ts";

// ─────────────────────────────────────────────────────────────
// GET (ping/health check)
// ─────────────────────────────────────────────────────────────

Deno.test({
  name: "sync-acessorias — GET (ping) returns { ok, timestamp }",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await getReq("sync-acessorias");
    assertEquals(res.status, 200);
    const body = await res.json();
    assertEquals(body.ok, true);
    assert(typeof body.timestamp === "string", "Expected timestamp string");
  },
});

// ─────────────────────────────────────────────────────────────
// POST — authentication & authorization
// ─────────────────────────────────────────────────────────────

Deno.test({
  name: "sync-acessorias — POST no token → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson("sync-acessorias", { tenant_slug: "contmax" });
    assertEquals(res.status, 401);
    const body = await res.json();
    assert(body.error !== undefined, "Expected error field");
  },
});

Deno.test({
  name: "sync-acessorias — POST invalid token → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson(
      "sync-acessorias",
      { tenant_slug: "contmax" },
      bearerAuth("invalid.jwt.token"),
    );
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "sync-acessorias — POST non-admin token → 403",
  ignore: !integrationEnvReady() || !USER_JWT,
  async fn() {
    const res = await postJson(
      "sync-acessorias",
      { tenant_slug: "contmax" },
      bearerAuth(USER_JWT),
    );
    assertEquals(res.status, 403);
    const body = await res.json();
    assert(body.error !== undefined, "Expected error field");
  },
});

// ─────────────────────────────────────────────────────────────
// POST — input validation
// ─────────────────────────────────────────────────────────────

Deno.test({
  name: "sync-acessorias — POST admin token + invalid tenant_slug → 400",
  ignore: !adminEnvReady(),
  async fn() {
    const res = await postJson(
      "sync-acessorias",
      { tenant_slug: "tenant_invalido" },
      bearerAuth(ADMIN_JWT),
    );
    assertEquals(res.status, 400);
    const body = await res.json();
    assert(body.error !== undefined, "Expected error field");
  },
});

Deno.test({
  name: "sync-acessorias — POST admin token + missing tenant_slug → 400",
  ignore: !adminEnvReady(),
  async fn() {
    const res = await postJson("sync-acessorias", {}, bearerAuth(ADMIN_JWT));
    assertEquals(res.status, 400);
    const body = await res.json();
    assert(body.error !== undefined, "Expected error field");
  },
});

// ─────────────────────────────────────────────────────────────
// POST — valid request (read-only smoke test)
// Requires TEST_TENANT_ID to be configured.
// ─────────────────────────────────────────────────────────────

Deno.test({
  name: "sync-acessorias — POST valid tenant returns job info (smoke test)",
  ignore: !adminEnvReady() || !Deno.env.get("TEST_TENANT_SLUG"),
  async fn() {
    const tenantSlug = Deno.env.get("TEST_TENANT_SLUG")!;
    const res = await postJson(
      "sync-acessorias",
      { tenant_slug: tenantSlug },
      bearerAuth(ADMIN_JWT),
    );
    const body = await res.json();

    // Either starts a sync job (200/201 with job data) or
    // returns batch_complete (200 with next_page) or integration disabled (400)
    assert(
      res.status === 200 || res.status === 400,
      `Unexpected status ${res.status}: ${JSON.stringify(body)}`,
    );

    if (res.ok) {
      assert(
        body.success || body.status === "batch_complete",
        `Expected success or batch_complete, got: ${JSON.stringify(body)}`,
      );
    }
  },
});
