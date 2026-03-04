/**
 * Questor SYN - Serviço de Integração
 * Envia dados de saídas fiscais do Portal Contmax para o Questor via API SYN
 *
 * Documentação: https://syn.questor.com.br/index.html
 * Endpoint produção: https://syn.questor.com.br
 */

import { supabase } from "@/integrations/supabase/client";
import type { Empresa, MesKey } from "@/types/fiscal";

// ---------------------------------------------------------------------------
// Configuração
// ---------------------------------------------------------------------------

const SYN_BASE_URL = "https://syn.questor.com.br";
const SYN_VERSAO = "2.00";

const CNPJ_ESCRITORIO = "72.165.533/0001-34";

const SYN_TOKEN = import.meta.env.VITE_QUESTOR_SYN_TOKEN ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJncmF6aUBjb250bWF4Y29udGFiaWxpZGFkZS5jb20uYnIiLCJqdGkiOiI3NWU0NGE4Ni05ZWVhLTQ3NzUtOTI4ZS02NzBjYjRjNDJlMjkiLCJjbnBqIjoiNzIxNjU1MzMwMDAxMzQiLCJlaEVycCI6InRydWUiLCJodHRwOi8vc2NoZW1hcy5taWNyb3NvZnQuY29tL3dzLzIwMDgvMDYvaWRlbnRpdHkvY2xhaW1zL3JvbGUiOiJFcnAiLCJleHAiOjE4MDM3Mzg3NTIsImlzcyI6ImFwaWVycCIsImF1ZCI6ImFwaWVycCJ9.aAHVQdjQiZidDkkf7DlH9WEhhWUpMK0eNXpJKPZjvbM";

const CODIGO_CLIENTE = "1";
const TIPO_IMPOSTO_ISS = "3.01";

const CFOP: Record<string, number> = {
  nacional: 9000002,
  exterior: 9000001,
  alugueis: 9000005,
};

// ---------------------------------------------------------------------------
// Tipos internos
// ---------------------------------------------------------------------------

interface TipoFaturamento {
  chave: "nacional" | "exterior" | "alugueis";
  valor: number;
}

export interface ResultadoEnvio {
  empresa: string;
  cnpj: string;
  tipo: string;
  sucesso: boolean;
  erro?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ultimoDiaMes(mes: MesKey, ano: number): string {
  const MES_INDEX: Record<MesKey, number> = {
    janeiro: 1, fevereiro: 2, marco: 3,
    abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9,
    outubro: 10, novembro: 11, dezembro: 12,
  };

  const mesNum = MES_INDEX[mes];
  const ultimoDia = new Date(ano, mesNum, 0).getDate();
  const dia = String(ultimoDia).padStart(2, "0");
  const mesStr = String(mesNum).padStart(2, "0");
  return `${dia}/${mesStr}/${ano}`;
}

function numeroDocumento(mes: MesKey, ano: number): string {
  const MES_INDEX: Record<MesKey, number> = {
    janeiro: 1, fevereiro: 2, marco: 3,
    abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9,
    outubro: 10, novembro: 11, dezembro: 12,
  };
  const mesNum = String(MES_INDEX[mes]).padStart(2, "0");
  return `${mesNum}${ano}`;
}

function formatarValor(valor: number): string {
  return valor.toFixed(2).replace(".", ",");
}

function montarArquivoDados(
  cnpjEmpresa: string,
  cfop: number,
  valor: number,
  dataDoc: string,
  numDoc: string
): string {
  const valorFormatado = formatarValor(valor);

  const registroC = [
    "C",
    cnpjEmpresa,
    CODIGO_CLIENTE,
    numDoc,
    numDoc,
    "REC",
    "",
    "",
    dataDoc,
    dataDoc,
    valorFormatado,
    "0,00",
    "0,00",
    "0,00",
    "0,00",
    "3",
    "",
    "",
    "",
    "",
    "",
    "0,00",
    "0,00",
    "0,00",
    "0,00",
    "0,00",
    "0,00",
    "0,00",
    "N",
    "P",
    "1",
    "1",
    "99",
    "",
    "0",
    "",
    "",
    "",
    "",
    "N",
  ].join(";");

  const registroD = [
    "D",
    cfop,
    TIPO_IMPOSTO_ISS,
    valorFormatado,
    "0,00",
    "0,00",
    "0,00",
    "0,00",
    valorFormatado,
  ].join(";");

  return `${registroC}\r\n${registroD}\r\n`;
}

// ---------------------------------------------------------------------------
// Envio individual
// ---------------------------------------------------------------------------

async function enviarSaidaEmpresa(
  empresa: Empresa,
  tipo: TipoFaturamento,
  mes: MesKey,
  ano: number
): Promise<ResultadoEnvio> {
  const cfop = CFOP[tipo.chave];
  const dataDoc = ultimoDiaMes(mes, ano);
  const numDoc = numeroDocumento(mes, ano);
  const dado = montarArquivoDados(empresa.cnpj, cfop, tipo.valor, dataDoc, numDoc);

  const payload = {
    cnpjCliente: empresa.cnpj,
    versao: SYN_VERSAO,
    grupoLayout: 201,
    dataDocumentos: dataDoc,
    dado,
    cnpjContabilidade: [CNPJ_ESCRITORIO],
  };

  try {
    const response = await fetch(`${SYN_BASE_URL}/api/v2/dados/inserir`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SYN_TOKEN}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        empresa: empresa.nome,
        cnpj: empresa.cnpj,
        tipo: tipo.chave,
        sucesso: false,
        erro: `HTTP ${response.status}: ${errorText}`,
      };
    }

    return { empresa: empresa.nome, cnpj: empresa.cnpj, tipo: tipo.chave, sucesso: true };
  } catch (err) {
    return {
      empresa: empresa.nome,
      cnpj: empresa.cnpj,
      tipo: tipo.chave,
      sucesso: false,
      erro: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

// ---------------------------------------------------------------------------
// Exportações públicas
// ---------------------------------------------------------------------------

export async function enviarSaidasMes(
  mes: MesKey,
  ano: number
): Promise<ResultadoEnvio[]> {
  if (!SYN_TOKEN) {
    throw new Error("Token SYN não configurado. Defina VITE_QUESTOR_SYN_TOKEN.");
  }

  const { data: empresas, error } = await supabase.from("empresas").select("*");
  if (error) throw new Error(`Erro ao buscar empresas: ${error.message}`);
  if (!empresas?.length) return [];

  const resultados: ResultadoEnvio[] = [];
  const empresasOk: string[] = [];

  for (const empresa of empresas as Empresa[]) {
    const dadosMes = empresa.meses[mes];
    if (dadosMes.lancadoQuestor !== "pendente") continue;

    const tipos: TipoFaturamento[] = [
      { chave: "nacional", valor: dadosMes.faturamentoNacional },
      { chave: "exterior", valor: dadosMes.faturamentoExterior },
      { chave: "alugueis", valor: dadosMes.faturamentoAlugueis || 0 },
    ].filter((t) => t.valor > 0) as TipoFaturamento[];

    if (!tipos.length) continue;

    let todosOk = true;
    for (const tipo of tipos) {
      const resultado = await enviarSaidaEmpresa(empresa, tipo, mes, ano);
      resultados.push(resultado);
      if (!resultado.sucesso) todosOk = false;
    }

    if (todosOk) empresasOk.push(empresa.id);
  }

  for (const empresaId of empresasOk) {
    const empresa = (empresas as Empresa[]).find((e) => e.id === empresaId)!;
    await supabase
      .from("empresas")
      .update({
        meses: {
          ...empresa.meses,
          [mes]: { ...empresa.meses[mes], lancadoQuestor: "ok" },
        },
      })
      .eq("id", empresaId);
  }

  return resultados;
}

export async function enviarSaidaEmpresaUnica(
  empresa: Empresa,
  mes: MesKey,
  ano: number
): Promise<ResultadoEnvio[]> {
  if (!SYN_TOKEN) {
    throw new Error("Token SYN não configurado. Defina VITE_QUESTOR_SYN_TOKEN.");
  }

  const dadosMes = empresa.meses[mes];
  const resultados: ResultadoEnvio[] = [];

  const tipos: TipoFaturamento[] = [
    { chave: "nacional", valor: dadosMes.faturamentoNacional },
    { chave: "exterior", valor: dadosMes.faturamentoExterior },
    { chave: "alugueis", valor: dadosMes.faturamentoAlugueis || 0 },
  ].filter((t) => t.valor > 0) as TipoFaturamento[];

  let todosOk = true;
  for (const tipo of tipos) {
    const resultado = await enviarSaidaEmpresa(empresa, tipo, mes, ano);
    resultados.push(resultado);
    if (!resultado.sucesso) todosOk = false;
  }

  if (todosOk) {
    await supabase
      .from("empresas")
      .update({
        meses: {
          ...empresa.meses,
          [mes]: { ...empresa.meses[mes], lancadoQuestor: "ok" },
        },
      })
      .eq("id", empresa.id);
  }

  return resultados;
}
