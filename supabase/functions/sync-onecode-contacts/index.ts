import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Jaro-Winkler ──────────────────────────────────────────────
function jaroWinkler(s1: string, s2: string): number {
  if (s1 === s2) return 1;
  const len1 = s1.length,
    len2 = s2.length;
  if (!len1 || !len2) return 0;
  const matchDist = Math.max(Math.floor(Math.max(len1, len2) / 2) - 1, 0);
  const s1m = new Array(len1).fill(false);
  const s2m = new Array(len2).fill(false);
  let matches = 0,
    transpositions = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist);
    const end = Math.min(i + matchDist + 1, len2);
    for (let j = start; j < end; j++) {
      if (s2m[j] || s1[i] !== s2[j]) continue;
      s1m[i] = true;
      s2m[j] = true;
      matches++;
      break;
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
  const jaro =
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  let prefix = 0;
  for (let i = 0; i < Math.min(4, Math.min(len1, len2)); i++) {
    if (s1[i] === s2[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

// ── Normalize ─────────────────────────────────────────────────
function normalize(name: string): string {
  return name
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(LTDA|ME|EPP|EIRELI|SA|S\.A\.?|S\/A)\b/g, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractCompanyName(contactName: string): string {
  const parts = contactName.split(" - ");
  return parts[0].trim();
}

// ── Fetch with retry ──────────────────────────────────────────
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      if (i === retries) return res;
    } catch (err) {
      if (i === retries) throw err;
    }
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  throw new Error("fetch failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const isInternalCall = token === serviceKey;

  const admin = createClient(supabaseUrl, serviceKey);

  if (!isInternalCall) {
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getUser();
    if (claimsErr || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.user.id;

    // Admin check
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  try {
    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id is required");

    const onecodeUrl = Deno.env.get("ONECODE_API_URL");
    const onecodeToken = Deno.env.get("ONECODE_API_TOKEN");
    if (!onecodeUrl || !onecodeToken) throw new Error("OneCode secrets not configured");

    // Fetch contacts from OneCode
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);
    const contactsRes = await fetchWithRetry(
      `${onecodeUrl}/api/contacts?page=1&pageSize=1000`,
      {
        headers: {
          Authorization: `Bearer ${onecodeToken}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );
    clearTimeout(timeout);

    if (!contactsRes.ok) {
      throw new Error(`OneCode API returned ${contactsRes.status}`);
    }
    const contactsBody = await contactsRes.json();
    const contacts: any[] = contactsBody.data || contactsBody.contacts || contactsBody || [];

    // Fetch companies for tenant
    const { data: companies, error: compErr } = await admin
      .from("empresas")
      .select("id, nome, whatsapp, onecode_contact_id, organizacao_id")
      .eq("organizacao_id", tenant_id);
    if (compErr) throw compErr;

    const companiesNorm = (companies || []).map((c: any) => ({
      ...c,
      normalized: normalize(c.nome),
    }));

    let totalMatched = 0,
      totalReview = 0,
      totalIgnored = 0;
    const matchLogs: any[] = [];
    const reviews: any[] = [];
    const updates: { id: string; whatsapp: string; onecode_contact_id: string }[] = [];

    for (const contact of contacts) {
      const rawName = contact.name || contact.nome || "";
      const phone = contact.phone || contact.telefone || contact.number || "";
      if (!rawName) continue;

      const extracted = extractCompanyName(rawName);
      const normContact = normalize(extracted);
      if (!normContact) continue;

      let bestScore = 0;
      let bestCompany: any = null;

      for (const comp of companiesNorm) {
        const score = jaroWinkler(normContact, comp.normalized);
        if (score > bestScore) {
          bestScore = score;
          bestCompany = comp;
        }
      }

      const contactId = String(contact.id || contact.contactId || "");

      if (bestScore >= 0.85 && bestCompany) {
        // Only update if not already linked
        if (!bestCompany.onecode_contact_id && !bestCompany.whatsapp) {
          updates.push({
            id: bestCompany.id,
            whatsapp: phone,
            onecode_contact_id: contactId,
          });
          totalMatched++;
          matchLogs.push({
            tenant_id,
            contact_id: contactId,
            contact_name: rawName,
            company_id: bestCompany.id,
            similarity_score: bestScore,
            status: "matched",
            processed_at: new Date().toISOString(),
          });
        } else {
          // Already linked, skip
          matchLogs.push({
            tenant_id,
            contact_id: contactId,
            contact_name: rawName,
            company_id: bestCompany.id,
            similarity_score: bestScore,
            status: "ignored",
          });
          totalIgnored++;
        }
      } else if (bestScore >= 0.7 && bestCompany) {
        totalReview++;
        matchLogs.push({
          tenant_id,
          contact_id: contactId,
          contact_name: rawName,
          company_id: bestCompany.id,
          similarity_score: bestScore,
          status: "review",
        });
        reviews.push({
          tenant_id,
          contact_id: contactId,
          contact_name: rawName,
          contact_phone: phone,
          suggested_company_id: bestCompany.id,
          suggested_company_name: bestCompany.nome,
          similarity_score: bestScore,
        });
      } else {
        totalIgnored++;
        matchLogs.push({
          tenant_id,
          contact_id: contactId,
          contact_name: rawName,
          company_id: bestCompany?.id || null,
          similarity_score: bestScore,
          status: "ignored",
        });
      }
    }

    // Apply updates
    for (const u of updates) {
      await admin
        .from("empresas")
        .update({
          whatsapp: u.whatsapp,
          onecode_contact_id: u.onecode_contact_id,
          whatsapp_synced_at: new Date().toISOString(),
        })
        .eq("id", u.id);
    }

    // Insert match logs in batches
    if (matchLogs.length) {
      await admin.from("onecode_contact_match_log").insert(matchLogs);
    }

    // Insert reviews (avoid duplicates by contact_id)
    if (reviews.length) {
      for (const r of reviews) {
        const { data: existing } = await admin
          .from("onecode_contact_review")
          .select("id")
          .eq("contact_id", r.contact_id)
          .eq("tenant_id", r.tenant_id)
          .eq("resolved", false)
          .maybeSingle();
        if (!existing) {
          await admin.from("onecode_contact_review").insert(r);
        }
      }
    }

    // Save integration log
    const executionTime = Date.now() - startTime;
    await admin.from("integration_logs").insert({
      tenant_id,
      integration: "onecode-contacts",
      status: "success",
      total_processados: contacts.length,
      total_matched: totalMatched,
      total_review: totalReview,
      total_ignored: totalIgnored,
      execution_time_ms: executionTime,
    });

    return new Response(
      JSON.stringify({
        success: true,
        total_processados: contacts.length,
        total_matched: totalMatched,
        total_review: totalReview,
        total_ignored: totalIgnored,
        execution_time_ms: executionTime,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    const executionTime = Date.now() - startTime;
    try {
      const body = await req.clone().json().catch(() => ({}));
      await admin.from("integration_logs").insert({
        tenant_id: (body as any)?.tenant_id || "unknown",
        integration: "onecode-contacts",
        status: "error",
        error_message: err.message,
        execution_time_ms: executionTime,
      });
    } catch (_) {}

    return new Response(
      JSON.stringify({ error: err.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
