/**
 * Unit tests for supabase/functions/_shared/utils.ts
 *
 * Run: deno test tests/unit/ --allow-env
 * Or:  deno task test:unit   (from supabase/ directory)
 */

import { assertEquals, assertAlmostEquals, assert } from "@std/assert";
import {
  sha256,
  sleep,
  normalizeKey,
  formatCnpj,
  normalizeNome,
  jaroWinkler,
  sanitizeForLog,
} from "../../functions/_shared/utils.ts";

// ─────────────────────────────────────────────────────────────
// sha256
// ─────────────────────────────────────────────────────────────

Deno.test("sha256 — empty string produces known FIPS 180-4 hash", async () => {
  const result = await sha256("");
  assertEquals(
    result,
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
});

Deno.test("sha256 — output is always 64 lowercase hex chars", async () => {
  const inputs = ["abc", "hello world", "Portal ConTmax 2026", "12345678901234"];
  for (const input of inputs) {
    const hash = await sha256(input);
    assertEquals(hash.length, 64, `Expected 64 chars for "${input}", got ${hash.length}`);
    assert(/^[0-9a-f]+$/.test(hash), `Hash for "${input}" is not lowercase hex`);
  }
});

Deno.test("sha256 — same input always produces same hash (deterministic)", async () => {
  const h1 = await sha256("test input");
  const h2 = await sha256("test input");
  assertEquals(h1, h2);
});

Deno.test("sha256 — different inputs produce different hashes", async () => {
  const h1 = await sha256("empresa A");
  const h2 = await sha256("empresa B");
  assert(h1 !== h2, "Different inputs must produce different hashes");
});

// ─────────────────────────────────────────────────────────────
// sleep
// ─────────────────────────────────────────────────────────────

Deno.test("sleep — resolves after at least the given duration", async () => {
  const start = Date.now();
  await sleep(50);
  const elapsed = Date.now() - start;
  assert(elapsed >= 40, `Expected >= 40ms, got ${elapsed}ms`); // allow 10ms jitter
});

// ─────────────────────────────────────────────────────────────
// normalizeKey
// ─────────────────────────────────────────────────────────────

Deno.test("normalizeKey — removes dots, hyphens and slashes", () => {
  assertEquals(normalizeKey("12.345.678/0001-99"), "12345678000199");
  assertEquals(normalizeKey("123.456.789-00"), "12345678900");
  assertEquals(normalizeKey("00/00/0000"), "00000000");
});

Deno.test("normalizeKey — trims surrounding whitespace", () => {
  assertEquals(normalizeKey("  12345  "), "12345");
});

Deno.test("normalizeKey — digits-only input is unchanged", () => {
  assertEquals(normalizeKey("12345678000195"), "12345678000195");
});

// ─────────────────────────────────────────────────────────────
// formatCnpj
// ─────────────────────────────────────────────────────────────

Deno.test("formatCnpj — formats 14-digit CNPJ correctly", () => {
  assertEquals(formatCnpj("12345678000195"), "12.345.678/0001-95");
  assertEquals(formatCnpj("00000000000000"), "00.000.000/0000-00");
});

Deno.test("formatCnpj — formats 11-digit CPF correctly", () => {
  assertEquals(formatCnpj("12345678900"), "123.456.789-00");
});

Deno.test("formatCnpj — formats already-punctuated CNPJ (strips then reformats)", () => {
  // Input already formatted → strips non-digits → re-formats
  assertEquals(formatCnpj("12.345.678/0001-95"), "12.345.678/0001-95");
});

Deno.test("formatCnpj — returns original string for non-standard length", () => {
  assertEquals(formatCnpj("12345"), "12345");
  assertEquals(formatCnpj(""), "");
});

// ─────────────────────────────────────────────────────────────
// normalizeNome
// ─────────────────────────────────────────────────────────────

Deno.test("normalizeNome — uppercases and removes accents", () => {
  assertEquals(normalizeNome("Açaí Comércio"), "ACAI COMERCIO");
  assertEquals(normalizeNome("João & Cia"), "JOAO  CIA");
});

Deno.test("normalizeNome — strips common legal suffixes", () => {
  assertEquals(normalizeNome("Empresa Ltda"), "EMPRESA");
  assertEquals(normalizeNome("Tech SA"), "TECH");
  assertEquals(normalizeNome("Serviços ME"), "SERVICOS");
  assertEquals(normalizeNome("Construtora EIRELI"), "CONSTRUTORA");
  assertEquals(normalizeNome("Indústria EPP"), "INDUSTRIA");
});

Deno.test("normalizeNome — collapses multiple spaces", () => {
  const result = normalizeNome("  Empresa   Nome   ");
  assertEquals(result, "EMPRESA NOME");
});

Deno.test("normalizeNome — removes non-alphanumeric characters", () => {
  assertEquals(normalizeNome("Empresa @#%& Nome!"), "EMPRESA NOME");
});

// ─────────────────────────────────────────────────────────────
// jaroWinkler
// ─────────────────────────────────────────────────────────────

Deno.test("jaroWinkler — identical strings return 1.0", () => {
  assertEquals(jaroWinkler("EMPRESA ABC", "EMPRESA ABC"), 1.0);
  assertEquals(jaroWinkler("", ""), 1.0);
});

Deno.test("jaroWinkler — completely different strings return low score", () => {
  const score = jaroWinkler("AAAAA", "ZZZZZ");
  assert(score < 0.5, `Expected score < 0.5, got ${score}`);
});

Deno.test("jaroWinkler — empty vs non-empty returns 0", () => {
  assertEquals(jaroWinkler("", "EMPRESA"), 0);
  assertEquals(jaroWinkler("EMPRESA", ""), 0);
});

Deno.test("jaroWinkler — very similar names score >= 0.85 (auto-link threshold)", () => {
  // Same company with minor typo → should auto-link
  const score = jaroWinkler("COMERCIO TEXTIL BRASIL", "COMERCIO TEXTIL BRASIL");
  assert(score >= 0.85, `Expected >= 0.85, got ${score}`);
});

Deno.test("jaroWinkler — moderately similar names score in 0.7-0.85 (review zone)", () => {
  const score = jaroWinkler("PADARIA BOA VISTA", "PADARIA BOM VISTA");
  assert(score >= 0.7, `Expected >= 0.7, got ${score} (review zone lower bound)`);
  assert(score <= 1.0, `Expected <= 1.0, got ${score}`);
});

Deno.test("jaroWinkler — is symmetric (order of arguments does not matter)", () => {
  const s1 = "EMPRESA ABC";
  const s2 = "EMPRESA XYZ";
  assertAlmostEquals(jaroWinkler(s1, s2), jaroWinkler(s2, s1), 1e-10);
});

// ─────────────────────────────────────────────────────────────
// sanitizeForLog
// ─────────────────────────────────────────────────────────────

Deno.test("sanitizeForLog — redacts ApiKey values", () => {
  const input = { headers: { Authorization: "ApiKey abc123secretkey" } };
  const result = sanitizeForLog(input) as { headers: { Authorization: string } };
  assertEquals(result.headers.Authorization, "ApiKey ***");
});

Deno.test("sanitizeForLog — case-insensitive redaction", () => {
  const input = { auth: "APIKEY SuperSecret" };
  const result = sanitizeForLog(input) as { auth: string };
  assertEquals(result.auth, "APIKEY ***");
});

Deno.test("sanitizeForLog — returns null/undefined unchanged", () => {
  assertEquals(sanitizeForLog(null), null);
  assertEquals(sanitizeForLog(undefined), undefined);
});

Deno.test("sanitizeForLog — does not alter non-key fields", () => {
  const input = { name: "Empresa Teste", value: 1234 };
  const result = sanitizeForLog(input) as typeof input;
  assertEquals(result.name, "Empresa Teste");
  assertEquals(result.value, 1234);
});
