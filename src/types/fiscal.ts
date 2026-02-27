export type RegimeTributario = "simples_nacional" | "lucro_presumido" | "lucro_real" | "mei" | "imunidade_tributaria" | "pessoa_fisica";

export const REGIME_LABELS: Record<RegimeTributario, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  mei: "MEI",
  imunidade_tributaria: "Imunidade Tributária",
  pessoa_fisica: "Pessoa Física",
};

export interface Socio {
  nome: string;
  percentual: number;
  cpf: string;
  distribuicaoLucros?: number;
}

export type StatusEntrega = "ok" | "pendente" | "nao_aplicavel";
export type StatusExtrato = "sim" | "nao" | "sem_faturamento";
export type StatusQuestor = "ok" | "sem_faturamento" | "pendente";

export interface DadosMensais {
  extratoEnviado: StatusExtrato;
  faturamentoNacional: number;
  faturamentoNotaFiscal: number;
  faturamentoExterior: number;
  faturamentoAlugueis: number;
  faturamentoTotal: number;
  distribuicaoLucros: number;
  lancadoQuestor: StatusQuestor;
  dctfWebSemMovimento?: StatusEntrega;
}

export interface ControleObrigacoes {
  lancamentoFiscal: StatusEntrega;
  reinf: StatusEntrega;
  dcftWeb: StatusEntrega;
  mit: StatusEntrega;
}

export type MesKey = 
  | "janeiro" | "fevereiro" | "marco" 
  | "abril" | "maio" | "junho" 
  | "julho" | "agosto" | "setembro" 
  | "outubro" | "novembro" | "dezembro";

export const MES_LABELS: Record<MesKey, string> = {
  janeiro: "Janeiro",
  fevereiro: "Fevereiro",
  marco: "Março",
  abril: "Abril",
  maio: "Maio",
  junho: "Junho",
  julho: "Julho",
  agosto: "Agosto",
  setembro: "Setembro",
  outubro: "Outubro",
  novembro: "Novembro",
  dezembro: "Dezembro",
};

// Meses que fecham trimestre - onde as obrigações são exigidas
export const MESES_FECHAMENTO_TRIMESTRE: MesKey[] = ["marco", "junho", "setembro", "dezembro"];

export function isMesFechamentoTrimestre(mes: MesKey): boolean {
  return MESES_FECHAMENTO_TRIMESTRE.includes(mes);
}

// Retorna os meses do trimestre para um mês de fechamento
export function getMesesTrimestre(mesFechamento: MesKey): MesKey[] {
  switch (mesFechamento) {
    case "marco":
      return ["janeiro", "fevereiro", "marco"];
    case "junho":
      return ["abril", "maio", "junho"];
    case "setembro":
      return ["julho", "agosto", "setembro"];
    case "dezembro":
      return ["outubro", "novembro", "dezembro"];
    default:
      return [mesFechamento];
  }
}

// Meses pós-fechamento onde DCTF Web sem movimento aparece (Abril, Julho, Outubro, Janeiro)
export const MESES_POS_DCTF: MesKey[] = ["abril", "julho", "outubro", "janeiro"];

export function isMesDctfPosFechamento(mes: MesKey): boolean {
  return MESES_POS_DCTF.includes(mes);
}

export function getTrimestreFechamentoAnterior(mes: MesKey): MesKey | null {
  const map: Partial<Record<MesKey, MesKey>> = {
    abril: "marco", maio: "marco",
    julho: "junho", agosto: "junho",
    outubro: "setembro", novembro: "setembro",
    janeiro: "dezembro", fevereiro: "dezembro",
  };
  return map[mes] ?? null;
}

export interface MesesData {
  janeiro: DadosMensais;
  fevereiro: DadosMensais;
  marco: DadosMensais;
  abril: DadosMensais;
  maio: DadosMensais;
  junho: DadosMensais;
  julho: DadosMensais;
  agosto: DadosMensais;
  setembro: DadosMensais;
  outubro: DadosMensais;
  novembro: DadosMensais;
  dezembro: DadosMensais;
}

export interface ObrigacoesData {
  marco: ControleObrigacoes;
  junho: ControleObrigacoes;
  setembro: ControleObrigacoes;
  dezembro: ControleObrigacoes;
}

export interface Empresa {
  id: string;
  numero: number;
  nome: string;
  cnpj: string;
  inicioCompetencia: string;
  dataCadastro: string;
  regimeTributario: RegimeTributario;
  emiteNotaFiscal: boolean;
  socios: Socio[];
  meses: MesesData;
  obrigacoes: ObrigacoesData;
  dataBaixa?: string;
  whatsapp?: string;
}

const MES_TO_INDEX: Record<MesKey, number> = {
  janeiro: 0, fevereiro: 1, marco: 2,
  abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8,
  outubro: 9, novembro: 10, dezembro: 11,
};

// Retorna o próximo mês de fechamento trimestral a partir de um mês dado
function getProximoFechamentoTrimestral(mesIndex: number): number {
  // Fechamentos: março(2), junho(5), setembro(8), dezembro(11)
  const fechamentos = [2, 5, 8, 11];
  for (const f of fechamentos) {
    if (f >= mesIndex) return f;
  }
  return 2; // próximo ano, março
}

/**
 * Verifica se uma empresa baixada ainda deve ser visível no mês selecionado.
 * A empresa fica visível até o próximo fechamento de trimestre após a data da baixa.
 * Exemplo: baixada em 15/02/2026 → visível até março/2026 (inclusive).
 */
export function isEmpresaBaixadaVisivel(dataBaixa: string, mesSelecionado: MesKey): boolean {
  const data = new Date(dataBaixa);
  const mesBaixa = data.getMonth(); // 0-based
  const limiteIndex = getProximoFechamentoTrimestral(mesBaixa);
  const mesAtualIndex = MES_TO_INDEX[mesSelecionado];
  return mesAtualIndex <= limiteIndex;
}

// Calcula faturamento total e distribuição de lucros
export function calcularFaturamento(dados: Omit<DadosMensais, "faturamentoTotal" | "distribuicaoLucros" | "lancadoQuestor" | "dctfWebSemMovimento"> & Partial<Pick<DadosMensais, "lancadoQuestor" | "dctfWebSemMovimento">>): DadosMensais {
  const faturamentoTotal = dados.faturamentoNacional + dados.faturamentoNotaFiscal + dados.faturamentoExterior + (dados.faturamentoAlugueis || 0);
  const distribuicaoLucros = faturamentoTotal * 0.75;
  return { ...dados, faturamentoAlugueis: dados.faturamentoAlugueis || 0, faturamentoTotal, distribuicaoLucros, lancadoQuestor: dados.lancadoQuestor ?? "pendente" };
}

// Calcula distribuição por sócio
export function calcularDistribuicaoSocios(socios: Socio[], distribuicaoTotal: number): Socio[] {
  return socios.map(s => ({
    ...s,
    distribuicaoLucros: (distribuicaoTotal * s.percentual) / 100
  }));
}

// Calcula faturamento acumulado do trimestre
export function calcularFaturamentoTrimestre(empresa: Empresa, mesFechamento: MesKey): number {
  const meses = getMesesTrimestre(mesFechamento);
  return meses.reduce((total, mes) => total + empresa.meses[mes].faturamentoTotal, 0);
}
