import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type MesKey =
  | "janeiro" | "fevereiro" | "marco" | "abril"
  | "maio" | "junho" | "julho" | "agosto"
  | "setembro" | "outubro" | "novembro" | "dezembro" | "fechamento";

export const MES_LABELS: Record<MesKey, string> = {
  janeiro: "Jan", fevereiro: "Fev", marco: "Mar", abril: "Abr",
  maio: "Mai", junho: "Jun", julho: "Jul", agosto: "Ago",
  setembro: "Set", outubro: "Out", novembro: "Nov", dezembro: "Dez",
  fechamento: "Fechamento",
};

export interface ServicosExtrasItem {
  descricao: string;
  valor: number;
}

export interface HonorarioMesData {
  num_funcionarios: number;
  servicos_extras: number;
  servicos_extras_items?: ServicosExtrasItem[];
  data_pagamento: string;
}

export interface HonorarioEmpresa {
  id: string;
  empresa_id: string;
  empresa_nome: string;
  fiscal_percentual: number;
  contabil_percentual: number;
  pessoal_valor: number;
  emitir_nf: string;
  nao_emitir_boleto: boolean;
  mes_inicial: MesKey;
  meses: Record<string, HonorarioMesData>;
}

const emptyMesData = (): HonorarioMesData => ({
  num_funcionarios: 0,
  servicos_extras: 0,
  servicos_extras_items: [],
  data_pagamento: "",
});

export function useHonorarios() {
  const [empresas, setEmpresas] = useState<HonorarioEmpresa[]>([]);
  const [allContmaxEmpresas, setAllContmaxEmpresas] = useState<{ id: string; nome: string }[]>([]);
  const [salarioMinimo, setSalarioMinimo] = useState(1618);
  const [configId, setConfigId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const contmaxOrgId = "d84e2150-0ae0-4462-880c-da8cec89e96a";

  const fetchAll = useCallback(async () => {
    setLoading(true);

    // Fetch config, honorarios_empresas, and all contmax empresas in parallel
    const [configRes, honorariosRes, empresasRes] = await Promise.all([
      supabase.from("honorarios_config").select("*").limit(1).single(),
      supabase.from("honorarios_empresas").select("*, empresas!inner(nome)").order("nome", { referencedTable: "empresas" }),
      supabase.from("empresas").select("id, nome").eq("organizacao_id", contmaxOrgId).is("data_baixa", null).order("nome"),
    ]);

    if (configRes.data) {
      setSalarioMinimo(Number(configRes.data.salario_minimo));
      setConfigId(configRes.data.id);
    }

    if (honorariosRes.data) {
      setEmpresas(
        honorariosRes.data.map((row: any) => ({
          id: row.id,
          empresa_id: row.empresa_id,
          empresa_nome: row.empresas?.nome ?? "",
          fiscal_percentual: Number(row.fiscal_percentual),
          contabil_percentual: Number(row.contabil_percentual),
          pessoal_valor: Number(row.pessoal_valor),
          emitir_nf: row.emitir_nf ?? "",
          nao_emitir_boleto: row.nao_emitir_boleto ?? false,
          mes_inicial: row.mes_inicial ?? "janeiro",
          meses: row.meses ?? {},
        }))
      );
    }

    if (empresasRes.data) {
      setAllContmaxEmpresas(empresasRes.data.map((e: any) => ({ id: e.id, nome: e.nome })));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const updateSalarioMinimo = useCallback(async (valor: number) => {
    if (!configId) return;
    const { error } = await supabase
      .from("honorarios_config")
      .update({ salario_minimo: valor } as any)
      .eq("id", configId);
    if (error) {
      toast({ title: "Erro ao atualizar salário mínimo", description: error.message, variant: "destructive" });
      return;
    }
    setSalarioMinimo(valor);
    toast({ title: "Salário mínimo atualizado" });
  }, [configId, toast]);

  const addEmpresa = useCallback(async (data: {
    empresa_id: string;
    fiscal_percentual: number;
    contabil_percentual: number;
    pessoal_valor: number;
    emitir_nf: string;
    nao_emitir_boleto: boolean;
    mes_inicial: string;
  }) => {
    const { error } = await supabase.from("honorarios_empresas").insert(data as any);
    if (error) {
      toast({ title: "Erro ao cadastrar empresa", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Empresa cadastrada com sucesso" });
    fetchAll();
    return true;
  }, [fetchAll, toast]);

  const updateEmpresa = useCallback(async (id: string, data: Partial<{
    fiscal_percentual: number;
    contabil_percentual: number;
    pessoal_valor: number;
    emitir_nf: string;
    nao_emitir_boleto: boolean;
    mes_inicial: string;
  }>) => {
    const { error } = await supabase.from("honorarios_empresas").update(data as any).eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar empresa", description: error.message, variant: "destructive" });
      return;
    }
    setEmpresas((prev) => prev.map((e) => (e.id === id ? { ...e, ...data } as HonorarioEmpresa : e)));
  }, [toast]);

  const deleteEmpresa = useCallback(async (id: string) => {
    const { error } = await supabase.from("honorarios_empresas").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao remover empresa", description: error.message, variant: "destructive" });
      return;
    }
    setEmpresas((prev) => prev.filter((e) => e.id !== id));
    toast({ title: "Empresa removida" });
  }, [toast]);

  const updateMesData = useCallback(async (id: string, mes: MesKey, field: keyof HonorarioMesData | Partial<HonorarioMesData>, value?: any) => {
    setEmpresas((prev) => {
      const empresa = prev.find((e) => e.id === id);
      if (!empresa) return prev;

      const currentMes = empresa.meses[mes] ?? emptyMesData();
      const updates = typeof field === "object" ? field : { [field]: value };
      const updatedMes = { ...currentMes, ...updates };
      const updatedMeses = { ...empresa.meses, [mes]: updatedMes };

      // Fire async update
      supabase
        .from("honorarios_empresas")
        .update({ meses: updatedMeses } as any)
        .eq("id", id)
        .then(({ error }) => {
          if (error) {
            toast({ title: "Erro ao atualizar dados mensais", description: error.message, variant: "destructive" });
          }
        });

      return prev.map((e) => (e.id === id ? { ...e, meses: updatedMeses } : e));
    });
  }, [toast]);

  const getMesData = useCallback((empresa: HonorarioEmpresa, mes: MesKey): HonorarioMesData => {
    return empresa.meses[mes] ?? emptyMesData();
  }, []);

  const calcularValores = useCallback((empresa: HonorarioEmpresa, mes: MesKey) => {
    const mesData = empresa.meses[mes] ?? emptyMesData();
    const valorFiscalContabil = ((empresa.fiscal_percentual + empresa.contabil_percentual) / 100) * salarioMinimo;
    const valorFuncionarios = empresa.pessoal_valor * mesData.num_funcionarios;
    const totalMes = valorFiscalContabil + valorFuncionarios + mesData.servicos_extras;
    return { valorFiscalContabil, valorFuncionarios, totalMes };
  }, [salarioMinimo]);

  // Filter out empresas already registered
  const empresasDisponiveis = allContmaxEmpresas.filter(
    (e) => !empresas.some((h) => h.empresa_id === e.id)
  );

  return {
    empresas,
    loading,
    salarioMinimo,
    empresasDisponiveis,
    addEmpresa,
    updateEmpresa,
    deleteEmpresa,
    updateMesData,
    getMesData,
    calcularValores,
    updateSalarioMinimo,
    refetch: fetchAll,
  };
}
