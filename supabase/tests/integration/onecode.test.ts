/**
 * Integration tests: onecode-webhook
 *
 * Requires env vars: SUPABASE_URL, SUPABASE_ANON_KEY
 *   + ONECODE_WEBHOOK_SECRET (for webhook tests)
 * Run: deno task test:integration  (from supabase/ directory)
 */

import {
  assertEquals,
  assert,
  integrationEnvReady,
  fnUrl,
  ONECODE_WEBHOOK_SECRET,
} from "./_helpers.ts";

// ─────────────────────────────────────────────────────────────
// onecode-webhook
// ─────────────────────────────────────────────────────────────

Deno.test({
  name: "onecode-webhook — no secret header → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await postJson("onecode-webhook", {
      data: { object: "messages", action: "create", payload: {} },
    });
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "onecode-webhook — wrong secret → 401",
  ignore: !integrationEnvReady(),
  async fn() {
    const res = await fetch(fnUrl("onecode-webhook"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-onecode-secret": "wrong_secret_value",
        "x-onecode-source": "contmax",
      },
      body: JSON.stringify({
        data: { object: "messages", action: "create", payload: {} },
      }),
    });
    assertEquals(res.status, 401);
  },
});

Deno.test({
  name: "onecode-webhook — correct secret + empty payload → 200 with ok:true",
  ignore: !integrationEnvReady() || !ONECODE_WEBHOOK_SECRET,
  async fn() {
    const res = await fetch(fnUrl("onecode-webhook"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-onecode-secret": ONECODE_WEBHOOK_SECRET,
        "x-onecode-source": "contmax",
      },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    assertEquals(res.status, 200);
    assertEquals(body.ok, true);
    assert(typeof body.event_id === "string", "Expected event_id string");
  },
});

Deno.test({
  name: "onecode-webhook — correct secret + unknown source → 401",
  ignore: !integrationEnvReady() || !ONECODE_WEBHOOK_SECRET,
  async fn() {
    const res = await fetch(fnUrl("onecode-webhook"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-onecode-secret": ONECODE_WEBHOOK_SECRET,
        "x-onecode-source": "source_invalido",
      },
      body: JSON.stringify({}),
    });
    assertEquals(res.status, 401);
  },
});

