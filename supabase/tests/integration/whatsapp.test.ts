/**
 * Integration tests: send-whatsapp & send-whatsapp-batch
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_ANON_KEY, TEST_ADMIN_JWT
 * Run: deno task test:integration  (from supabase/ directory)
 *
 * NOTE: Tests that pass valid payloads to send-whatsapp will attempt to send
 * a real WhatsApp message via OneCode. Those tests are marked with
 * `ignore: true` by default to avoid unintentional sends.
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
// send-whatsapp
// ─────────────────────────────────────────────────────────────

Deno.test({
  name: "send-whatsapp — no token → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson("send-whatsapp", {
      to: "5511999999999",
      body: "Teste",
      empresa_id: "00000000-0000-0000-0000-000000000000",
    });
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "send-whatsapp — invalid token → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson(
      "send-whatsapp",
      { to: "5511999999999", body: "Teste", empresa_id: "00000000-0000-0000-0000-000000000000" },
      bearerAuth("bad.token"),
    );
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "send-whatsapp — admin token + empty body → error",
  ignore: !adminEnvReady(),
  async fn() {
    // Empty JSON body → should result in a handled error (400 or 500)
    const res = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_JWT}`,
        },
        body: "{}",
      },
    );
    assert(res.status >= 400, `Expected error status, got ${res.status}`);
    const body = await res.json();
    assert(body.error !== undefined, "Expected error field in response");
  },
});

// ─────────────────────────────────────────────────────────────
// send-whatsapp-batch
// ─────────────────────────────────────────────────────────────

Deno.test({
  name: "send-whatsapp-batch — no token → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson("send-whatsapp-batch", {
      items: [{ empresaId: "x", to: "5511999999999", body: "Teste" }],
    });
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "send-whatsapp-batch — invalid token → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson(
      "send-whatsapp-batch",
      { items: [{ empresaId: "x", to: "5511999999999", body: "Teste" }] },
      bearerAuth("invalid.token"),
    );
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "send-whatsapp-batch — admin token + empty items array → graceful response",
  ignore: !adminEnvReady(),
  async fn() {
    const res = await postJson(
      "send-whatsapp-batch",
      { items: [] },
      bearerAuth(ADMIN_JWT),
    );
    // Empty items array should succeed with an empty results array (no messages sent)
    const body = await res.json();
    if (res.ok) {
      assert(Array.isArray(body.results), "Expected results array");
      assertEquals(body.results.length, 0);
    } else {
      // Some implementations return 400 for empty batch — both are acceptable
      assert(body.error !== undefined, "Expected error field");
    }
  },
});

Deno.test({
  name: "send-whatsapp-batch — admin token + missing items field → error",
  ignore: !adminEnvReady(),
  async fn() {
    const res = await postJson("send-whatsapp-batch", {}, bearerAuth(ADMIN_JWT));
    assert(res.status >= 400, `Expected error status, got ${res.status}`);
  },
});
