import * as XLSX from "xlsx";
import { Empresa, MesKey, MES_LABELS, REGIME_LABELS, isMesFechamentoTrimestre, getMesesTrimestre, isMesDctfPosFechamento, getTrimestreFechamentoAnterior, calcularFaturamentoTrimestre } from "@/types/fiscal";

function getMesFechamentoTrimestre(mes: MesKey): MesKey {
  if (["janeiro", "fevereiro", "marco"].includes(mes)) return "marco";
  if (["abril", "maio", "junho"].includes(mes)) return "junho";
  if (["julho", "agosto", "setembro"].includes(mes)) return "setembro";
  return "dezembro";
}

const formatCurrency = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusLabel = (s: string) => {
  if (s === "ok") return "OK";
  if (s === "pendente") return "Pendente";
  if (s === "nao_aplicavel") return "N/A";
  return s;
};

const extratoLabel = (s: string) => {
  if (s === "sim") return "Enviado";
  if (s === "nao") return "Não Enviado";
  if (s === "sem_faturamento") return "Sem Faturamento";
  return s;
};

const questorLabel = (s: string) => {
  if (s === "ok") return "OK";
  if (s === "sem_faturamento") return "Sem Faturamento";
  if (s === "pendente") return "Pendente";
  return s;
};

export function exportClientesToExcel(empresas: Empresa[], nomeOrg: string) {
  const rows = empresas.map((e) => {
    const base: Record<string, any> = {
      "Nº": e.numero,
      Empresa: e.nome,
      CNPJ: e.cnpj,
      "Regime Tributário": REGIME_LABELS[e.regimeTributario],
      "Emite NF": e.emiteNotaFiscal ? "Sim" : "Não",
      "Início Competência": e.inicioCompetencia || "—",
      WhatsApp: e.whatsapp || "",
      Status: e.dataBaixa
        ? `Baixada em ${new Date(e.dataBaixa).toLocaleDateString("pt-BR")}`
        : "Ativa",
    };
    e.socios.forEach((s, i) => {
      base[`Sócio ${i + 1}`] = s.nome;
      base[`CPF Sócio ${i + 1}`] = s.cpf;
      base[`% Sócio ${i + 1}`] = s.percentual;
    });
    return base;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clientes");
  XLSX.writeFile(wb, `Clientes_${nomeOrg}.xlsx`);
}

export function exportToExcel(empresas: Empresa[], mesSelecionado: MesKey) {
  const isFechamento = isMesFechamentoTrimestre(mesSelecionado);
  const mesTrimestre = getMesFechamentoTrimestre(mesSelecionado);
  const isDctfPos = isMesDctfPosFechamento(mesSelecionado);
  const trimestreAnterior = getTrimestreFechamentoAnterior(mesSelecionado);

  const rows = empresas.map((e) => {
    const mes = e.meses[mesSelecionado];
    const base: Record<string, any> = {
      "Nº": e.numero,
      Empresa: e.nome,
      CNPJ: e.cnpj,
      Regime: REGIME_LABELS[e.regimeTributario],
      "Emite NF": e.emiteNotaFiscal ? "Sim" : "Não",
      Extrato: extratoLabel(mes.extratoEnviado),
      "Faturamento Nacional": mes.faturamentoNacional,
      "Faturamento NF": mes.faturamentoNotaFiscal,
      "Faturamento Exterior": mes.faturamentoExterior,
      "Faturamento Aluguéis": mes.faturamentoAlugueis || 0,
      "Faturamento Total": mes.faturamentoTotal,
      "Lanç. Questor": questorLabel(mes.lancadoQuestor ?? "pendente"),
      "Dist. Lucros (75%)": mes.distribuicaoLucros,
    };

    if (isFechamento) {
      const mesesTri = getMesesTrimestre(mesSelecionado);
      const fatTrimestral = mesesTri.reduce((s, m) => s + e.meses[m].faturamentoTotal, 0);
      const obr = e.obrigacoes[mesTrimestre as keyof typeof e.obrigacoes];
      base["Fat. Trimestral"] = fatTrimestral;
      base["Dist. Trimestral"] = fatTrimestral * 0.75;
      base["Lanç. Fiscal"] = statusLabel(obr.lancamentoFiscal);
      base["REINF"] = statusLabel(obr.reinf);
      base["DCTFWeb"] = statusLabel(obr.dcftWeb);
      if (e.regimeTributario === "lucro_presumido") {
        base["MIT"] = statusLabel(obr.mit);
      }
    }

    if (isDctfPos && trimestreAnterior) {
      const fat = calcularFaturamentoTrimestre(e, trimestreAnterior);
      base["DCTF S/Mov"] = fat > 0 ? statusLabel(mes.dctfWebSemMovimento ?? "pendente") : "—";
    }

    e.socios.forEach((s, i) => {
      base[`Sócio ${i + 1}`] = s.nome;
      base[`CPF Sócio ${i + 1}`] = s.cpf;
      base[`% Sócio ${i + 1}`] = s.percentual;
    });

    return base;
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, MES_LABELS[mesSelecionado]);
  XLSX.writeFile(wb, `Controle_Fiscal_${MES_LABELS[mesSelecionado]}_2026.xlsx`);
}
