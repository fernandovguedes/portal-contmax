/**
 * Questor SYN - Serviço de Integração
 * Envia dados de saídas fiscais do Portal Contmax para o Questor via API SYN
 * Formato validado em 05/03/2026
 */

import { supabase } from "@/integrations/supabase/client";
import type { Empresa, MesKey } from "@/types/fiscal";

const SYN_VERSAO = "2.00";
const CNPJ_ESCRITORIO = "72.165.533/0001-34";
const CODIGO_CLIENTE = "1"; // Consumidor RS - código interno Questor
const TIPO_IMPOSTO_ISS = "2"; // ISS=2 no Questor
const SIGLA_ESTADO_FATO_GERADOR = "RS";
const CODIGO_MUNIC_FATO_GERADOR = "80"; // Canoas/RS - código interno Questor

const CFOP: Record<string, number> = {
  nacional: 9000002,
  exterior: 9000001,
  alugueis: 9000005,
};

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

function ultimoDiaMes(mes: MesKey, ano: number): string {
  const MES_INDEX: Record<MesKey, number> = {
    janeiro: 1, fevereiro: 2, marco: 3,
    abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9,
    outubro: 10, novembro: 11, dezembro: 12,
  };
  const mesNum = MES_INDEX[mes];
  const ultimoDia = new Date(ano, mesNum, 0).getDate();
  return `${String(ultimoDia).padStart(2, "0")}/${String(mesNum).padStart(2, "0")}/${ano}`;
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
  const v = formatarValor(valor);

  // Registro C - 64 campos (formato validado em 05/03/2026)
  // Campos 41-57: 17 vazios entre "0" (campo 40) e RS (campo 58)
  const registroC = [
    "C",            // 1
    cnpjEmpresa,    // 2
    CODIGO_CLIENTE, // 3
    numDoc,         // 4
    numDoc,         // 5
    "REC",          // 6
    "",             // 7
    "",             // 8
    dataDoc,        // 9
    dataDoc,        // 10
    v,              // 11
    "0,00",         // 12
    "0,00",         // 13
    "0,00",         // 14
    "0,00",         // 15
    "99",           // 16
    "",             // 17
    "",             // 18
    "",             // 19
    "0",            // 20
    "",             // 21
    "0,00",         // 22
    "0,00",         // 23
    "0,00",         // 24
    "0,00",         // 25
    "0,00",         // 26
    "0,00",         // 27
    "0,00",         // 28
    "0",            // 29
    "",             // 30
    "0",            // 31
    "2",            // 32
    "99",           // 33
    "9",            // 34
    "0",            // 35
    "",             // 36
    "",             // 37
    "",             // 38
    "~",            // 39
    "0",            // 40
    "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", // 41-57: 17 vazios
    SIGLA_ESTADO_FATO_GERADOR, // 58
    CODIGO_MUNIC_FATO_GERADOR, // 59
    "1",            // 60
    "2",            // 61
    "",             // 62
    "",             // 63
    "",             // 64
  ].join(";");

  // Registro D
  const registroD = [
    "D",
    cfop,
    TIPO_IMPOSTO_ISS,
    v,
    "0,00",
    "0,00",
    "0,00",
    "0,00",
    v,
  ].join(";");

  return `${registroC}\r\n${registroD}\r\n`;
}

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
    const { error } = await supabase.functions.invoke("questor-proxy", {
      body: payload,
    });

    if (error) {
      return { empresa: empresa.nome, cnpj: empresa.cnpj, tipo: tipo.chave, sucesso: false, erro: error.message };
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

/**
 * Envia saídas das empresas fornecidas (já filtradas pela tela).
 * Processa apenas as que estão com lancadoQuestor === "pendente" e faturamento > 0.
 */
export async function enviarSaidasMes(
  empresasFiltradas: Empresa[],
  mes: MesKey,
  ano: number
): Promise<ResultadoEnvio[]> {
  const resultados: ResultadoEnvio[] = [];
  const empresasOk: string[] = [];

  const pendentes = empresasFiltradas.filter((e) => {
    const d = e.meses[mes];
    return (
      d.lancadoQuestor === "pendente" &&
      (d.faturamentoNacional > 0 || d.faturamentoExterior > 0 || (d.faturamentoAlugueis || 0) > 0)
    );
  });

  for (const empresa of pendentes) {
    const dadosMes = empresa.meses[mes];

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

    if (todosOk) empresasOk.push(empresa.id);
  }

  // Atualiza lancadoQuestor = "ok" no Supabase
  for (const empresaId of empresasOk) {
    const empresa = pendentes.find((e) => e.id === empresaId)!;
    await supabase
      .from("empresas")
      .update({
        meses: JSON.parse(JSON.stringify({
          ...empresa.meses,
          [mes]: { ...empresa.meses[mes], lancadoQuestor: "ok" },
        })),
      })
      .eq("id", empresaId);
  }

  return resultados;
}
