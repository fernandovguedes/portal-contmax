/**
 * Shared utility functions for Supabase Edge Functions.
 * These are pure functions with no external dependencies, making them fully unit-testable.
 */

/** SHA-256 hash of a UTF-8 string, returned as lowercase hex (64 chars) */
export async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Resolves after `ms` milliseconds */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Removes dots, hyphens and slashes from a raw CNPJ/CPF string.
 * Used to produce a stable `external_key` for DB matching.
 */
export function normalizeKey(raw: string): string {
  return raw.replace(/[.\-\/]/g, "").trim();
}

/**
 * Formats a raw numeric CNPJ (14 digits) or CPF (11 digits) string with punctuation.
 * Returns the original string unchanged if it is neither.
 */
export function formatCnpj(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  }
  return raw;
}

/**
 * Normalizes a company name for fuzzy matching:
 * uppercases, removes accents, strips common legal suffixes (LTDA, SA, ME, etc.),
 * removes non-alphanumeric characters and collapses whitespace.
 */
export function normalizeNome(name: string): string {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(LTDA|ME|EPP|EIRELI|SA|S\.A\.?|S\/A)\b/g, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Jaro-Winkler similarity score between two strings.
 * Returns a float in [0, 1] where 1 means identical.
 * Thresholds used: >= 0.85 → auto-link, >= 0.7 → manual review.
 */
export function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length, len2 = s2.length;
  if (!len1 || !len2) return 0;
  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);
  const s1m = new Array(len1).fill(false);
  const s2m = new Array(len2).fill(false);
  let matches = 0, transpositions = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2m[j] || s1[i] !== s2[j]) continue;
      s1m[i] = true; s2m[j] = true; matches++; break;
    }
  }
  if (!matches) return 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1m[i]) continue;
    while (!s2m[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }
  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

/**
 * Redacts API key values in any serializable object (for safe logging).
 * Replaces "ApiKey <value>" patterns with "ApiKey ***".
 */
export function sanitizeForLog(obj: unknown): unknown {
  if (!obj) return obj;
  const s = JSON.stringify(obj);
  return JSON.parse(s.replace(/ApiKey\s+[^\s"]+/gi, "ApiKey ***"));
}
