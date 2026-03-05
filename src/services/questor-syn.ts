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

  // Registro C - 65 campos (formato validado em 05/03/2026)
  const registroC = [
    "C",                          // 1: tipo registro
    cnpjEmpresa,                  // 2: CNPJ empresa (com máscara)
    CODIGO_CLIENTE,               // 3: código cliente interno Questor (1=Consumidor RS)
    numDoc,                       // 4: período inicial (MMAAAA)
    numDoc,                       // 5: período final (MMAAAA)
    "REC",                        // 6: espécie
    "",                           // 7: série
    "",                           // 8: subsérie
    dataDoc,                      // 9: data escrituração
    dataDoc,                      // 10: data emissão
    v,                            // 11: valor contábil
    "0,00",                       // 12: base ICMS
    "0,00",                       // 13: valor ICMS
    "0,00",                       // 14: isentas
    "0,00",                       // 15: outras
    "99",                         // 16: modelo (99=não entra SINTEGRA)
    "",                           // 17: vazio
    "",                           // 18: vazio
    "",                           // 19: vazio
    "0",                          // 20: 0
    "",                           // 21: vazio
    "0,00",                       // 22: base IPI
    "0,00",                       // 23: valor IPI
    "0,00",                       // 24: isentas IPI
    "0,00",                       // 25: outras IPI
    "0,00",                       // 26: valor frete
    "0,00",                       // 27: valor seguro
    "0,00",                       // 28: outras despesas
    "0",                          // 29: acréscimo financeiro
    "",                           // 30: emitente NF (vazio)
    "0",                          // 31: finalidade operação (0=Normal)
    "2",                          // 32: indicador pagamento (2=Outros)
    "99",                         // 33: meio pagamento
    "9",                          // 34: modalidade frete
    "0",                          // 35: situação documento (0=Regular)
    "",                           // 36: vazio
    "",                           // 37: vazio
    "",                           // 38: vazio
    "~",                          // 39: til
    "0",                          // 40: 0
    "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", // 41-58: 18 campos vazios
    SIGLA_ESTADO_FATO_GERADOR,    // 59: sigla estado fato gerador
    CODIGO_MUNIC_FATO_GERADOR,    // 60: código município fato gerador (interno Questor)
    "1",                          // 61
    "2",                          // 62
    "",                           // 63: vazio
    "",                           // 64: vazio
    "",                           // 65: vazio
  ].join(";");

  // Registro D - natureza/CFOP
  const registroD = [
    "D",
    cfop,               // CFOP
    TIPO_IMPOSTO_ISS,   // tipo imposto (2=ISS)
    v,                  // valor contábil
    "0,00",             // base cálculo
    "0,00",             // alíquota
    "0,00",             // valor imposto
    "0,00",             // isentas
    v,                  // outras
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
