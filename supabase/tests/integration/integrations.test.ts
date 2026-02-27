/**
 * Integration tests: run-integration & process-integration-job
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_ANON_KEY, TEST_ADMIN_JWT
 * Run: deno task test:integration  (from supabase/ directory)
 */

import { assertEquals, assert } from "@std/assert";
import {
  integrationEnvReady,
  adminEnvReady,
  postJson,
  bearerAuth,
  ADMIN_JWT,
} from "./_helpers.ts";

// ─────────────────────────────────────────────────────────────
// run-integration
// ─────────────────────────────────────────────────────────────

Deno.test({
  name: "run-integration — no token → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson("run-integration", {
      tenant_id: "00000000-0000-0000-0000-000000000000",
      provider_slug: "acessorias",
    });
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "run-integration — invalid token → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson(
      "run-integration",
      { tenant_id: "00000000-0000-0000-0000-000000000000", provider_slug: "acessorias" },
      bearerAuth("not.a.valid.jwt"),
    );
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "run-integration — admin token + unknown provider → error",
  ignore: !adminEnvReady(),
  async fn() {
    const res = await postJson(
      "run-integration",
      {
        tenant_id: "00000000-0000-0000-0000-000000000000",
        provider_slug: "provider_inexistente",
      },
      bearerAuth(ADMIN_JWT),
    );
    // Expect integration-not-found error (400, 404, or 500)
    const body = await res.json();
    assert(
      res.status >= 400,
      `Expected error status for unknown provider, got ${res.status}`,
    );
    assert(body.error !== undefined, "Expected error field in response");
  },
});

Deno.test({
  name: "run-integration — admin token + missing provider_slug → error",
  ignore: !adminEnvReady(),
  async fn() {
    const res = await postJson(
      "run-integration",
      { tenant_id: "00000000-0000-0000-0000-000000000000" },
      bearerAuth(ADMIN_JWT),
    );
    assert(res.status >= 400, `Expected error, got ${res.status}`);
  },
});

Deno.test({
  name: "run-integration — response shape contains job_id when job is created",
  ignore: !adminEnvReady(),
  async fn() {
    // Use a real tenant_id + valid provider that is configured.
    // If the integration is not found/enabled, we still check the response shape.
    const tenantId = Deno.env.get("TEST_TENANT_ID");
    if (!tenantId) {
      console.log("Skipping: TEST_TENANT_ID not set");
      return;
    }

    const res = await postJson(
      "run-integration",
      { tenant_id: tenantId, provider_slug: "acessorias" },
      bearerAuth(ADMIN_JWT),
    );
    const body = await res.json();

    if (res.ok) {
      assert(typeof body.job_id === "string", "Expected job_id string in response");
      assertEquals(body.status, "pending");
    } else if (res.status === 409) {
      // Job already running — expected in busy environments
      assert(body.job_id !== undefined || body.error !== undefined);
    } else {
      // Integration not configured for this tenant
      assert(body.error !== undefined, "Expected error field");
    }
  },
});

// ─────────────────────────────────────────────────────────────
// process-integration-job
// ─────────────────────────────────────────────────────────────

Deno.test({
  name: "process-integration-job — no token → error or 'no pending jobs'",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson("process-integration-job", {});
    // This function uses service role key internally.
    // Without it, it may return 401 or attempt to process with no jobs.
    const body = await res.json();
    assert(
      res.status === 401 || body.message === "No pending jobs" || body.status === "delegated",
      `Unexpected response: ${res.status} ${JSON.stringify(body)}`,
    );
  },
});
