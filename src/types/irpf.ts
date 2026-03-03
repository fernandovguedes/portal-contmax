export type IrpfStatus = "aguardando_docs" | "em_analise" | "em_andamento" | "finalizado" | "entregue";
export type IrpfSource = "PG" | "AVULSO";
export type IrpfRegime = "completa" | "simplificada";

export interface IrpfDependente {
  nome: string;
  cpf: string;
  nascimento: string;
  parentesco: string;
}

export interface IrpfPerson {
  id: string;
  tenantId: string;
  source: IrpfSource;
  pgEmpresaId?: string;
  pgSocioCpf?: string;
  nome: string;
  cpf: string;
  email?: string;
  telefone?: string;
  dataNascimento?: string;
  ativo: boolean;
  // joined
  empresaNome?: string;
}

export interface IrpfCase {
  id: string;
  tenantId: string;
  irpfPersonId: string;
  anoBase: number;
  status: IrpfStatus;
  responsavel: string;
  valorCobrado: number;
  dataPagamento?: string;
  regime?: IrpfRegime;
  senhaGovbr?: string;
  enderecoCompleto?: string;
  valorApostas?: string;
  estadoCivil?: string;
  cpfConjuge?: string;
  dependentes: IrpfDependente[];
  observacoes?: string;
  createdAt?: string;
  updatedAt?: string;
  // joined
  personNome?: string;
  personCpf?: string;
  personSource?: IrpfSource;
  personEmpresaNome?: string;
  docCount?: number;
}

export interface IrpfDocument {
  id: string;
  irpfCaseId: string;
  tenantId: string;
  docType: string;
  path: string;
  originalName?: string;
  mimeType?: string;
  sizeBytes?: number;
  createdAt: string;
  notes?: string;
}

export const DOC_TYPES = [
  { key: "IDENTIFICACAO", label: "Documento de Identidade (RG ou CNH)" },
  { key: "DECLARACAO_ANTERIOR", label: "Declaração do ano anterior" },
  { key: "INFORME_RENDIMENTOS", label: "Informes de Rendimentos (empresa/INSS/IPE/bancos)" },
  { key: "EXTRATO_BANCARIO", label: "Extratos bancários em 31/12 (todas as contas)" },
  { key: "DESPESA_MEDICA", label: "Comprovantes de despesas médicas" },
  { key: "DESPESA_EDUCACAO", label: "Comprovantes de escolas e cursos técnicos" },
  { key: "BENS_IMOVEIS", label: "Imóveis adquiridos/vendidos (matrícula, valor, financiamento)" },
  { key: "BENS_VEICULOS", label: "Veículos adquiridos/vendidos (documento do veículo)" },
  { key: "INVESTIMENTOS", label: "Movimentações em bolsa de valores ou criptomoedas" },
  { key: "OUTROS", label: "Outros documentos" },
] as const;

export const STATUS_CONFIG: Record<IrpfStatus, { label: string; className: string }> = {
  aguardando_docs: { label: "Aguardando Docs", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  em_analise: { label: "Em Análise", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  em_andamento: { label: "Em Andamento", className: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  finalizado: { label: "Finalizado", className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  entregue: { label: "Entregue", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
};

export const RESPONSAVEIS = ["Grazi", "Pedro"] as const;
