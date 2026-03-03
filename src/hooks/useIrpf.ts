import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import type { IrpfPerson, IrpfCase, IrpfSource, IrpfStatus } from "@/types/irpf";

function rowToPerson(r: any): IrpfPerson {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    source: r.source as IrpfSource,
    pgEmpresaId: r.pg_empresa_id ?? undefined,
    pgSocioCpf: r.pg_socio_cpf ?? undefined,
    nome: r.nome,
    cpf: r.cpf,
    email: r.email ?? undefined,
    telefone: r.telefone ?? undefined,
    dataNascimento: r.data_nascimento ?? undefined,
    ativo: r.ativo,
    empresaNome: r.empresas?.nome ?? undefined,
  };
}

function rowToCase(r: any): IrpfCase {
  const person = r.irpf_people;
  return {
    id: r.id,
    tenantId: r.tenant_id,
    irpfPersonId: r.irpf_person_id,
    anoBase: r.ano_base,
    status: r.status as IrpfStatus,
    responsavel: r.responsavel,
    valorCobrado: Number(r.valor_cobrado) || 0,
    dataPagamento: r.data_pagamento || undefined,
    regime: r.regime || undefined,
    senhaGovbr: r.senha_govbr || undefined,
    enderecoCompleto: r.endereco_completo || undefined,
    valorApostas: r.valor_apostas || undefined,
    estadoCivil: r.estado_civil || undefined,
    cpfConjuge: r.cpf_conjuge || undefined,
    dependentes: Array.isArray(r.dependentes) ? r.dependentes : [],
    observacoes: r.observacoes || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    personNome: person?.nome,
    personCpf: person?.cpf,
    personSource: person?.source as IrpfSource | undefined,
    personEmpresaNome: person?.empresas?.nome ?? undefined,
  };
}

export function useIrpf(tenantId: string | undefined, anoBase: number) {
  const { user } = useAuth();
  const [people, setPeople] = useState<IrpfPerson[]>([]);
  const [cases, setCases] = useState<IrpfCase[]>([]);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!tenantId || !user) return;
    setLoading(true);

    const [peopleRes, casesRes] = await Promise.all([
      supabase
        .from("irpf_people")
        .select("*, empresas:pg_empresa_id(nome)")
        .eq("tenant_id", tenantId)
        .eq("ativo", true)
        .order("nome"),
      supabase
        .from("irpf_cases")
        .select("*, irpf_people!inner(nome, cpf, source, pg_empresa_id, empresas:pg_empresa_id(nome))")
        .eq("tenant_id", tenantId)
        .eq("ano_base", anoBase)
        .order("created_at", { ascending: false }),
    ]);

    if (peopleRes.error) {
      toast({ title: "Erro ao carregar pessoas", description: peopleRes.error.message, variant: "destructive" });
    } else {
      setPeople((peopleRes.data || []).map(rowToPerson));
    }

    if (casesRes.error) {
      toast({ title: "Erro ao carregar declarações", description: casesRes.error.message, variant: "destructive" });
    } else {
      setCases((casesRes.data || []).map(rowToCase));
    }

    // doc counts
    if (casesRes.data && casesRes.data.length > 0) {
      const caseIds = casesRes.data.map((c: any) => c.id);
      const { data: docs } = await supabase
        .from("irpf_documents")
        .select("irpf_case_id")
        .in("irpf_case_id", caseIds);
      
      const counts: Record<string, number> = {};
      (docs || []).forEach((d: any) => {
        counts[d.irpf_case_id] = (counts[d.irpf_case_id] || 0) + 1;
      });
      setDocCounts(counts);
    } else {
      setDocCounts({});
    }

    setLoading(false);
  }, [tenantId, anoBase, user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createPerson = useCallback(async (data: {
    nome: string; cpf: string; source: IrpfSource;
    email?: string; telefone?: string;
    pgEmpresaId?: string; pgSocioCpf?: string;
  }) => {
    if (!tenantId || !user) return null;
    const { data: person, error } = await supabase
      .from("irpf_people")
      .insert({
        tenant_id: tenantId,
        nome: data.nome,
        cpf: data.cpf,
        source: data.source,
        email: data.email || null,
        telefone: data.telefone || null,
        pg_empresa_id: data.pgEmpresaId || null,
        pg_socio_cpf: data.pgSocioCpf || null,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        toast({ title: "CPF já cadastrado", description: "Já existe uma pessoa com este CPF nesta organização.", variant: "destructive" });
      } else {
        toast({ title: "Erro ao criar pessoa", description: error.message, variant: "destructive" });
      }
      return null;
    }
    return person;
  }, [tenantId, user]);

  const createCase = useCallback(async (personId: string) => {
    if (!tenantId) return null;
    const { data, error } = await supabase
      .from("irpf_cases")
      .insert({
        tenant_id: tenantId,
        irpf_person_id: personId,
        ano_base: anoBase,
      })
      .select("id")
      .single();

    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        toast({ title: "Declaração já existe", description: `Já existe uma declaração para o ano ${anoBase}.`, variant: "destructive" });
      } else {
        toast({ title: "Erro ao criar declaração", description: error.message, variant: "destructive" });
      }
      return null;
    }
    toast({ title: "Declaração criada com sucesso" });
    await fetchAll();
    return data;
  }, [tenantId, anoBase, fetchAll]);

  const createPersonAndCase = useCallback(async (data: Parameters<typeof createPerson>[0]) => {
    const person = await createPerson(data);
    if (!person) return null;
    const caseResult = await createCase(person.id);
    return caseResult;
  }, [createPerson, createCase]);

  const updateCaseInline = useCallback(async (caseId: string, field: string, value: any) => {
    const dbField = ({
      responsavel: "responsavel",
      valorCobrado: "valor_cobrado",
      dataPagamento: "data_pagamento",
      status: "status",
    } as Record<string, string>)[field];
    if (!dbField) return;

    const { error } = await supabase
      .from("irpf_cases")
      .update({ [dbField]: value })
      .eq("id", caseId);

    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      return;
    }
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, [field]: value } : c));
  }, []);

  const updateCaseFull = useCallback(async (caseId: string, data: Partial<IrpfCase>) => {
    const row: any = {};
    if (data.status !== undefined) row.status = data.status;
    if (data.responsavel !== undefined) row.responsavel = data.responsavel;
    if (data.valorCobrado !== undefined) row.valor_cobrado = data.valorCobrado;
    if (data.dataPagamento !== undefined) row.data_pagamento = data.dataPagamento;
    if (data.regime !== undefined) row.regime = data.regime;
    if (data.observacoes !== undefined) row.observacoes = data.observacoes;
    if (data.senhaGovbr !== undefined) row.senha_govbr = data.senhaGovbr;
    if (data.enderecoCompleto !== undefined) row.endereco_completo = data.enderecoCompleto;
    if (data.valorApostas !== undefined) row.valor_apostas = data.valorApostas;
    if (data.estadoCivil !== undefined) row.estado_civil = data.estadoCivil;
    if (data.cpfConjuge !== undefined) row.cpf_conjuge = data.cpfConjuge;
    if (data.dependentes !== undefined) row.dependentes = data.dependentes;

    const { error } = await supabase
      .from("irpf_cases")
      .update(row)
      .eq("id", caseId);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Salvo com sucesso" });
    await fetchAll();
    return true;
  }, [fetchAll]);

  return {
    people, cases, docCounts, loading, refetch: fetchAll,
    createPerson, createCase, createPersonAndCase,
    updateCaseInline, updateCaseFull,
  };
}
