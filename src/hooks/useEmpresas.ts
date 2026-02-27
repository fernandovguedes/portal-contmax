import { useState, useEffect, useCallback } from "react";
import { Empresa, StatusExtrato, StatusQuestor, MesesData, ObrigacoesData, DadosMensais, ControleObrigacoes } from "@/types/fiscal";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const emptyMes = (): DadosMensais => ({
  extratoEnviado: "nao" as StatusExtrato,
  faturamentoNacional: 0,
  faturamentoNotaFiscal: 0,
  faturamentoExterior: 0,
  faturamentoAlugueis: 0,
  faturamentoTotal: 0,
  distribuicaoLucros: 0,
  lancadoQuestor: "pendente" as StatusQuestor,
});

const emptyObrigacoes = (): ControleObrigacoes => ({
  lancamentoFiscal: "pendente" as const,
  reinf: "pendente" as const,
  dcftWeb: "pendente" as const,
  mit: "pendente" as const,
});

const createEmptyMeses = (): MesesData => ({
  janeiro: emptyMes(), fevereiro: emptyMes(), marco: emptyMes(),
  abril: emptyMes(), maio: emptyMes(), junho: emptyMes(),
  julho: emptyMes(), agosto: emptyMes(), setembro: emptyMes(),
  outubro: emptyMes(), novembro: emptyMes(), dezembro: emptyMes(),
});

const createEmptyObrigacoes = (): ObrigacoesData => ({
  marco: emptyObrigacoes(), junho: emptyObrigacoes(),
  setembro: emptyObrigacoes(), dezembro: emptyObrigacoes(),
});

function rowToEmpresa(row: any): Empresa {
  const defaultMeses = createEmptyMeses();
  const defaultObrigacoes = createEmptyObrigacoes();
  const rawMeses = row.meses ?? {};
  const rawObrigacoes = row.obrigacoes ?? {};

  // When loaded with light columns, meses/obrigacoes won't be present
  const hasMeses = row.meses !== undefined;
  const hasObrigacoes = row.obrigacoes !== undefined;

  return {
    id: row.id,
    numero: row.numero,
    nome: row.nome,
    cnpj: row.cnpj,
    inicioCompetencia: row.data_abertura ?? "",
    dataCadastro: row.data_cadastro,
    regimeTributario: row.regime_tributario,
    emiteNotaFiscal: row.emite_nota_fiscal,
    socios: row.socios ?? [],
    dataBaixa: row.data_baixa ?? undefined,
    whatsapp: row.whatsapp ?? "",
    meses: hasMeses ? {
      janeiro: { ...defaultMeses.janeiro, ...rawMeses.janeiro },
      fevereiro: { ...defaultMeses.fevereiro, ...rawMeses.fevereiro },
      marco: { ...defaultMeses.marco, ...rawMeses.marco },
      abril: { ...defaultMeses.abril, ...rawMeses.abril },
      maio: { ...defaultMeses.maio, ...rawMeses.maio },
      junho: { ...defaultMeses.junho, ...rawMeses.junho },
      julho: { ...defaultMeses.julho, ...rawMeses.julho },
      agosto: { ...defaultMeses.agosto, ...rawMeses.agosto },
      setembro: { ...defaultMeses.setembro, ...rawMeses.setembro },
      outubro: { ...defaultMeses.outubro, ...rawMeses.outubro },
      novembro: { ...defaultMeses.novembro, ...rawMeses.novembro },
      dezembro: { ...defaultMeses.dezembro, ...rawMeses.dezembro },
    } : defaultMeses,
    obrigacoes: hasObrigacoes ? {
      marco: { ...defaultObrigacoes.marco, ...rawObrigacoes.marco },
      junho: { ...defaultObrigacoes.junho, ...rawObrigacoes.junho },
      setembro: { ...defaultObrigacoes.setembro, ...rawObrigacoes.setembro },
      dezembro: { ...defaultObrigacoes.dezembro, ...rawObrigacoes.dezembro },
    } : defaultObrigacoes,
  };
}

function empresaToRow(empresa: Partial<Empresa>) {
  const row: Record<string, any> = {};
  if (empresa.nome !== undefined) row.nome = empresa.nome;
  if (empresa.cnpj !== undefined) row.cnpj = empresa.cnpj;
  if (empresa.inicioCompetencia !== undefined) row.data_abertura = empresa.inicioCompetencia;
  if (empresa.dataCadastro !== undefined) row.data_cadastro = empresa.dataCadastro;
  if (empresa.regimeTributario !== undefined) row.regime_tributario = empresa.regimeTributario;
  if (empresa.emiteNotaFiscal !== undefined) row.emite_nota_fiscal = empresa.emiteNotaFiscal;
  if (empresa.socios !== undefined) row.socios = empresa.socios;
  if (empresa.meses !== undefined) row.meses = empresa.meses;
  if (empresa.obrigacoes !== undefined) row.obrigacoes = empresa.obrigacoes;
  if (empresa.dataBaixa !== undefined) row.data_baixa = empresa.dataBaixa;
  if (empresa.whatsapp !== undefined) row.whatsapp = empresa.whatsapp;
  return row;
}

function empresaToFullRow(e: Empresa) {
  return {
    numero: e.numero,
    nome: e.nome,
    cnpj: e.cnpj,
    data_abertura: e.inicioCompetencia,
    data_cadastro: e.dataCadastro || "2026-01-01",
    regime_tributario: e.regimeTributario,
    emite_nota_fiscal: e.emiteNotaFiscal,
    socios: e.socios,
    meses: e.meses,
    obrigacoes: e.obrigacoes,
  };
}

export function useEmpresas(organizacaoId?: string) {
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const seedDatabase = useCallback(async () => {
    if (!organizacaoId) return false;
    try {
      const { SEED_DATA } = await import("@/data/seed");
      const rows = SEED_DATA.map((e) => ({ ...empresaToFullRow(e), organizacao_id: organizacaoId }));

      for (let i = 0; i < rows.length; i += 50) {
        const batch = rows.slice(i, i + 50);
        const { error } = await supabase.from("empresas").insert(batch as any);
        if (error) {
          console.error("Seed batch error:", error);
          toast({ title: "Erro ao popular banco", description: error.message, variant: "destructive" });
          return false;
        }
      }
      toast({ title: "Dados carregados!", description: `${rows.length} empresas importadas com sucesso.` });
      return true;
    } catch (err) {
      console.error("Seed error:", err);
      return false;
    }
  }, [organizacaoId, toast]);

  const fetchEmpresas = useCallback(async () => {
    if (!organizacaoId) {
      setEmpresas([]);
      setLoading(false);
      return;
    }

    const COLUMNS = "id, numero, nome, cnpj, regime_tributario, emite_nota_fiscal, data_abertura, data_baixa, data_cadastro, whatsapp, socios, organizacao_id, meses, obrigacoes";
    const { data, error } = await supabase
      .from("empresas")
      .select(COLUMNS)
      .eq("organizacao_id", organizacaoId)
      .order("nome", { ascending: true });
    if (error) {
      toast({ title: "Erro ao carregar empresas", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      const seeded = await seedDatabase();
      if (seeded) {
        const { data: seededData } = await supabase
          .from("empresas")
          .select(COLUMNS)
          .eq("organizacao_id", organizacaoId)
          .order("nome", { ascending: true });
        setEmpresas((seededData ?? []).map(rowToEmpresa));
      }
    } else {
      setEmpresas(data.map(rowToEmpresa));
    }
    setLoading(false);
  }, [organizacaoId, seedDatabase, toast]);

  useEffect(() => {
    fetchEmpresas();
  }, [fetchEmpresas]);

  const addEmpresa = useCallback(async (empresa: Omit<Empresa, "id" | "dataCadastro">) => {
    const row = empresaToRow({
      ...empresa,
      dataCadastro: new Date().toISOString().split("T")[0],
    });
    if (empresa.numero) row.numero = empresa.numero;
    if (organizacaoId) row.organizacao_id = organizacaoId;
    const { error } = await supabase.from("empresas").insert(row as any);
    if (error) {
      toast({ title: "Erro ao adicionar empresa", description: error.message, variant: "destructive" });
      return;
    }
    fetchEmpresas();
  }, [fetchEmpresas, toast]);

  const updateEmpresa = useCallback(async (id: string, updates: Partial<Empresa>) => {
    const row = empresaToRow(updates);
    const { error } = await supabase.from("empresas").update(row).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar empresa", description: error.message, variant: "destructive" });
      return;
    }
    setEmpresas((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  }, [toast]);

  const deleteEmpresa = useCallback(async (id: string) => {
    const { error } = await supabase.from("empresas").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao deletar empresa", description: error.message, variant: "destructive" });
      return;
    }
    setEmpresas((prev) => prev.filter((e) => e.id !== id));
  }, [toast]);

  const baixarEmpresa = useCallback(async (id: string, data: string) => {
    const { error } = await supabase.from("empresas").update({ data_baixa: data } as any).eq("id", id);
    if (error) {
      toast({ title: "Erro ao baixar empresa", description: error.message, variant: "destructive" });
      return;
    }
    setEmpresas((prev) => prev.map((e) => (e.id === id ? { ...e, dataBaixa: data } : e)));
    toast({ title: "Empresa baixada com sucesso" });
  }, [toast]);

  const reativarEmpresa = useCallback(async (id: string) => {
    const { error } = await supabase.from("empresas").update({ data_baixa: null } as any).eq("id", id);
    if (error) {
      toast({ title: "Erro ao reativar empresa", description: error.message, variant: "destructive" });
      return;
    }
    setEmpresas((prev) => prev.map((e) => (e.id === id ? { ...e, dataBaixa: undefined } : e)));
    toast({ title: "Empresa reativada com sucesso" });
  }, [toast]);

  return { empresas, loading, addEmpresa, updateEmpresa, deleteEmpresa, baixarEmpresa, reativarEmpresa, setEmpresas, refetch: fetchEmpresas };
}
