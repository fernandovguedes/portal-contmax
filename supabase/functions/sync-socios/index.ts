import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function normalizarCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, "");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function buscarSociosRF(cnpj: string) {
  const c = normalizarCNPJ(cnpj);
  try {
    const res = await fetch(`https://publica.cnpj.ws/cnpj/${c}`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      if (res.status === 429) throw new Error("rate_limit");
      console.warn(`[sync-socios] CNPJ ${c} status ${res.status}`);
      return null;
    }
    const data = await res.json();
    // deno-lint-ignore no-explicit-any
    return (data.qsa ?? []).map((s: any) => ({
      nome: s.nome_socio ?? "",
      cpf: s.cnpj_cpf_do_socio ?? "",
      qualificacao: s.qualificacao_socio?.descricao ?? "",
      data_entrada: s.data_entrada_sociedade ?? null,
      percentual: s.percentual_capital_social ?? 0,
    }));
  } catch (err) {
    if ((err as Error).message === "rate_limit") throw err;
    console.error(`[sync-socios] erro CNPJ ${c}:`, err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    });
  }

  try {
    const url = new URL(req.url);
    const orgSlug = url.searchParams.get("org");

    let orgIds: string[] | null = null;
    if (orgSlug) {
      const { data: orgs } = await supabase
        .from("organizacoes")
        .select("id")
        .eq("slug", orgSlug);
      // deno-lint-ignore no-explicit-any
      orgIds = orgs?.map((o: any) => o.id) ?? [];
      console.log(`[sync-socios] org=${orgSlug} -> ${orgIds.length} id(s)`);
    }

    // deno-lint-ignore no-explicit-any
    let query: any = supabase
      .from("empresas")
      .select("id, cnpj, nome, socios, organizacao_id")
      .not("cnpj", "is", null)
      .is("data_baixa", null);

    if (orgIds && orgIds.length > 0) {
      query = query.in("organizacao_id", orgIds);
    }

    const { data: empresas, error } = await query;
    if (error) throw error;

    console.log(`[sync-socios] total empresas: ${empresas.length}`);

    let updated = 0, skipped = 0, errors = 0;
    const updates: string[] = [];

    for (const empresa of empresas) {
      try {
        const socios = await buscarSociosRF(empresa.cnpj);
        if (socios === null) { skipped++; continue; }

        if (JSON.stringify(empresa.socios ?? []) === JSON.stringify(socios)) {
          skipped++;
          continue;
        }

        const { error: upErr } = await supabase
          .from("empresas")
          .update({ socios })
          .eq("id", empresa.id);

        if (upErr) {
          errors++;
          console.error(`[sync-socios] update err ${empresa.cnpj}:`, upErr);
        } else {
          updated++;
          updates.push(`${empresa.cnpj} - ${empresa.nome} (${socios.length} socios)`);
          console.log(`[sync-socios] ok ${empresa.cnpj}: ${socios.length} socios`);
        }

        await sleep(1100);
      } catch (err) {
        if ((err as Error).message === "rate_limit") {
          console.warn("[sync-socios] rate limit, aguardando 60s...");
          await sleep(60000);
          skipped++;
        } else {
          errors++;
          console.error(`[sync-socios] err empresa ${empresa.cnpj}:`, err);
        }
      }
    }

    const summary = `read=${empresas.length} updated=${updated} skipped=${skipped} errors=${errors}`;
    console.log(`[sync-socios] concluido: ${summary}`);

    return new Response(
      JSON.stringify({ summary, updated, skipped, errors, updates }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (err) {
    console.error("[sync-socios] erro fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
