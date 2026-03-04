/**
 * Questor SYN - Serviço de Integração
 * Envia dados de saídas fiscais do Portal Contmax para o Questor via API SYN
 */

import { supabase } from "@/integrations/supabase/client";
import type { Empresa, MesKey } from "@/types/fiscal";

const SYN_VERSAO = "2.00";
const CNPJ_ESCRITORIO = "72.165.533/0001-34";
const CODIGO_CLIENTE = "1";
const TIPO_IMPOSTO_ISS = "3.01";

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
  return `${String(MES_INDEX[mes]).padStart(2, "0")}${ano}`;
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

  const registroC = [
    "C", cnpjEmpresa, CODIGO_CLIENTE, numDoc, numDoc,
    "REC", "", "", dataDoc, dataDoc, v,
    "0,00", "0,00", "0,00", "0,00", "3", "", "", "", "", "",
    "0,00", "0,00", "0,00", "0,00", "0,00", "0,00", "0,00",
    "N", "P", "1", "1", "99", "", "0", "", "", "", "", "N",
  ].join(";");

  const registroD = [
    "D", cfop, TIPO_IMPOSTO_ISS, v, "0,00", "0,00", "0,00", "0,00", v,
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
    return { empresa: empresa.nome, cnpj: empresa.cnpj, tipo: tipo.chave, sucesso: false, erro: err instanceof Error ? err.message : "Erro desconhecido" };
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
        meses: {
          ...empresa.meses,
          [mes]: { ...empresa.meses[mes], lancadoQuestor: "ok" },
        },
      })
      .eq("id", empresaId);
  }

  return resultados;
}
