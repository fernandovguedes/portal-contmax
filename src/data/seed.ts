import { Empresa, StatusExtrato, MesesData, ObrigacoesData, Socio, DadosMensais, ControleObrigacoes, RegimeTributario } from "@/types/fiscal";
import { EMPRESAS_EXTRAS } from "./empresas-cadastro";

const emptyMes = (): DadosMensais => ({
  extratoEnviado: "nao" as StatusExtrato,
  faturamentoNacional: 0,
  faturamentoNotaFiscal: 0,
  faturamentoExterior: 0,
  faturamentoAlugueis: 0,
  faturamentoTotal: 0,
  distribuicaoLucros: 0,
  lancadoQuestor: "pendente",
});

const createEmptyMeses = (): MesesData => ({
  janeiro: emptyMes(),
  fevereiro: emptyMes(),
  marco: emptyMes(),
  abril: emptyMes(),
  maio: emptyMes(),
  junho: emptyMes(),
  julho: emptyMes(),
  agosto: emptyMes(),
  setembro: emptyMes(),
  outubro: emptyMes(),
  novembro: emptyMes(),
  dezembro: emptyMes(),
});

const emptyObrigacoes = (): ControleObrigacoes => ({
  lancamentoFiscal: "pendente" as const,
  reinf: "pendente" as const,
  dcftWeb: "pendente" as const,
  mit: "pendente" as const,
});

const createEmptyObrigacoes = (): ObrigacoesData => ({
  marco: emptyObrigacoes(),
  junho: emptyObrigacoes(),
  setembro: emptyObrigacoes(),
  dezembro: emptyObrigacoes(),
});

// Função para criar empresa
// CPF values in calls below are placeholders and NOT used — real PII has been removed.
let _seedCpfIdx = 0;
function fakeCpf(): string {
  _seedCpfIdx++;
  const n = String(_seedCpfIdx).padStart(9, '0');
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-00`;
}

function criarEmpresa(
  numero: number,
  nome: string,
  cnpj: string,
  dataAbertura: string,
  emiteNotaFiscal: boolean,
  socios: Socio[],
  janeiro?: Partial<DadosMensais>,
  fevereiro?: Partial<DadosMensais>,
  marco?: Partial<DadosMensais>,
  regime: import("@/types/fiscal").RegimeTributario = "simples_nacional"
): Empresa {
  // Anonymize CPFs at creation time
  const anonSocios = socios.map(s => ({ ...s, cpf: fakeCpf() }));
  const meses = createEmptyMeses();
  
  if (janeiro) {
    meses.janeiro = { ...emptyMes(), ...janeiro };
  }
  if (fevereiro) {
    meses.fevereiro = { ...emptyMes(), ...fevereiro };
  }
  if (marco) {
    meses.marco = { ...emptyMes(), ...marco };
  }
  
  return {
    id: crypto.randomUUID(),
    numero,
    nome,
    cnpj,
    inicioCompetencia: dataAbertura,
    dataCadastro: "2026-01-01",
    regimeTributario: regime,
    emiteNotaFiscal,
    socios: anonSocios,
    meses,
    obrigacoes: createEmptyObrigacoes(),
  };
}

// Dados importados da planilha CONTROLE JAN FEV MAR.2026
export const SEED_DATA: Empresa[] = [
  criarEmpresa(412, "AR CONSULTORIA ESPORTIVA LTDA", "51.705.623/0001-09", "2023-08-07", false, 
    [{ nome: "Andre Luis Rustiguer", percentual: 100, cpf: "392.342.938-00" }]),
  
  criarEmpresa(495, "ADJ NEGOCIOS LTDA", "53.720.368/0001-90", "2024-01-30", false, 
    [{ nome: "Alan Pereira Mendes", percentual: 100, cpf: "058.455.931-31" }]),
  
  criarEmpresa(535, "ARTHUR SPORTS LTDA", "54.248.937/0001-00", "2024-03-01", false, 
    [{ nome: "Arthur dos Santos Azeredo", percentual: 100, cpf: "137.192.507-09" }],
    { extratoEnviado: "sim", faturamentoNacional: 84717.62, faturamentoTotal: 84717.62, distribuicaoLucros: 63538.21 }),
  
  criarEmpresa(534, "ALLEIVAS SERVICOS LTDA", "55.273.723/0001-56", "2024-05-24", false, 
    [{ nome: "Angelo Lorensi Leivas", percentual: 100, cpf: "009.604.860-38" }],
    { extratoEnviado: "sim", faturamentoNacional: 4763.24, faturamentoTotal: 4763.24, distribuicaoLucros: 3572.43 }),
  
  criarEmpresa(591, "AS PUBLICIDADE LTDA", "55.673.697/0001-53", "2024-06-25", false, 
    [{ nome: "Aline Stemke Beyenke", percentual: 100, cpf: "029.859.310-61" }]),
  
  criarEmpresa(625, "ASSESSORIA EMPRESARIAL OSWALDO REINER LTDA", "56.425.427/0001-96", "2024-08-09", false, 
    [{ nome: "OSWALDO REINER DE SOUZA NETO", percentual: 100, cpf: "398.409.268-70" }]),
  
  criarEmpresa(656, "ANDRADE ASSESSORIA LTDA", "57.352.444/0001-03", "2024-09-19", false, 
    [{ nome: "CHRISTIAN JOSUE FREYTAG DE ANDRADE", percentual: 100, cpf: "040.864.230-06" }],
    { extratoEnviado: "sim", faturamentoNacional: 5830.00, faturamentoTotal: 5830.00, distribuicaoLucros: 4372.50 }),
  
  criarEmpresa(659, "ALEXINVESTMENT LTDA", "57.415.686/0001-07", "2024-09-24", true, 
    [{ nome: "ALEX PORTES VIANA SANTOS", percentual: 100, cpf: "047.262.611-69" }],
    { extratoEnviado: "sem_faturamento" }),
  
  criarEmpresa(670, "AMORIM ASSESSORIA ESPORTIVA LTDA", "57.544.226/0001-70", "2024-10-03", false, 
    [{ nome: "Alex Amorim Pereira", percentual: 100, cpf: "131.271.729-74" }],
    { extratoEnviado: "sem_faturamento" }),
  
  criarEmpresa(727, "ASSESSORIA CANTOS LTDA", "58.325.783/0001-63", "2024-12-03", false, 
    [{ nome: "VINICIUS XAVIER FLORENCIO", percentual: 100, cpf: "136.282.906-43" }]),
  
  criarEmpresa(731, "ALM NEGOCIOS E INVESTIMENTOS LTDA", "58.491.632/0001-85", "2024-12-17", false, 
    [{ nome: "ALISSON DE LIMA MACIEL", percentual: 100, cpf: "049.229.551-43" }],
    { extratoEnviado: "sim", faturamentoNacional: 15800.00, faturamentoTotal: 15800.00, distribuicaoLucros: 11850.00 }),
  
  criarEmpresa(733, "ALVES BUSINESS LTDA", "58.495.999/0001-77", "2024-12-17", false, 
    [{ nome: "DAVI ALVES DA COSTA", percentual: 100, cpf: "191.621.607-29" }],
    { extratoEnviado: "sem_faturamento" }),
  
  criarEmpresa(780, "ABREIZ CONSULTORIA ESTRATEGICA LTDA", "59.198.412/0001-20", "2025-01-30", false, 
    [{ nome: "MAURICIO JUNIOR SANTOS FREIRE", percentual: 100, cpf: "128.066.086-43" }],
    { extratoEnviado: "sim", faturamentoNacional: 4995.10, faturamentoTotal: 4995.10, distribuicaoLucros: 3746.32 }),
  
  criarEmpresa(782, "ASS EMPRESARIAL LTDA", "59.211.554/0001-80", "2025-01-31", false, 
    [{ nome: "ALISSON DOS SANTOS SILVA", percentual: 100, cpf: "081.411.615-98" }]),
  
  criarEmpresa(802, "ALPHONSE ASSESSORIA LTDA", "59.647.387/0001-15", "2025-02-25", false, 
    [{ nome: "MATHEUS FERREIRA ALPHONSE DOS ANJOS", percentual: 100, cpf: "429.353.638-84" }],
    { extratoEnviado: "sem_faturamento" }),
  
  criarEmpresa(803, "ARMP INVESTIMENTOS LTDA", "59.331.494/0001-30", "2025-02-06", true, 
    [
      { nome: "ALAN ROGERIO DE PAULA", percentual: 50, cpf: "380.748.568-60" },
      { nome: "MORGANA PERIS DOS SANTOS", percentual: 50, cpf: "415.357.128-80" }
    ]),
  
  criarEmpresa(804, "ARRUDEX CONSULTORIA LTDA", "59.643.699/0001-50", "2025-02-25", false, 
    [{ nome: "RAPHAEL ARRUDA DE OLIVEIRA", percentual: 100, cpf: "044.099.721-62" }],
    { extratoEnviado: "sim", faturamentoNacional: 73899.01, faturamentoTotal: 73899.01, distribuicaoLucros: 55424.26 }),
  
  criarEmpresa(805, "AVELINO BET LTDA", "59.282.974/0001-58", "2025-02-04", false, 
    [{ nome: "MAYOVIKEV AVELINO DE FIGUEREDO SEGUNDO", percentual: 100, cpf: "137.878.824-99" }],
    { extratoEnviado: "sem_faturamento" }),
  
  criarEmpresa(867, "AGILLIZE INVESTIMENTO ESPORTIVO LTDA", "60.054.990/0001-72", "2025-03-24", false, 
    [{ nome: "JOAO VICTOR PINHEIRO DO VALE", percentual: 100, cpf: "704.549.284-75" }]),
  
  criarEmpresa(865, "ANJOS&CARDOSO LTDA", "60.056.232/0001-93", "2025-03-24", false, 
    [
      { nome: "MAYLLA GABRIELLA DOS ANJOS CARDOSO", percentual: 50, cpf: "087.036.926-12" },
      { nome: "RENAN CORREA CARDOSO", percentual: 50, cpf: "070.344.306-24" }
    ],
    { extratoEnviado: "sim", faturamentoNacional: 29005.40, faturamentoTotal: 29005.40, distribuicaoLucros: 21754.05 }),
  
  criarEmpresa(885, "AVTMS ENGENHARIA E INVESTIMENTOS LTDA", "59.985.236/0001-77", "2025-03-19", false, 
    [{ nome: "ARTHUR VAN TOL MENDES SAMPAIO", percentual: 100, cpf: "403.699.368-25" }],
    { extratoEnviado: "sem_faturamento" }),
  
  criarEmpresa(887, "AC ASSESSORIA LTDA", "60.184.864/0001-32", "2025-04-01", true, 
    [{ nome: "AQUILA HENRIQUE CALIGIORNE CRUZ", percentual: 100, cpf: "073.807.266-41" }],
    { extratoEnviado: "sim", faturamentoNacional: 18300.00, faturamentoNotaFiscal: 1028.59, faturamentoTotal: 19328.59, distribuicaoLucros: 14496.44 }),
  
  criarEmpresa(888, "ADTRADERS INVESTIMENTOS LTDA", "60.180.036/0001-26", "2025-04-01", false, 
    [
      { nome: "ANDRE LUIZ OLIVEIRA DE ASSUMPCAO", percentual: 50, cpf: "115.615.657-25" },
      { nome: "DIEGO DA FONSECA CAVOUR", percentual: 50, cpf: "121.907.207-96" }
    ],
    { extratoEnviado: "sim", faturamentoNacional: 7086.57, faturamentoTotal: 7086.57, distribuicaoLucros: 5314.93 }),
  
  criarEmpresa(889, "AF CONSULTORIA LTDA", "60.347.871/0001-08", "2025-04-10", false, 
    [{ nome: "ANDRE SILVESTRI FERRO", percentual: 100, cpf: "068.516.409-88" }],
    { extratoEnviado: "sim", faturamentoNacional: 80997.14, faturamentoTotal: 80997.14, distribuicaoLucros: 60747.86 }),
  
  criarEmpresa(930, "AMANOZZ LTDA", "60.621.882/0001-34", "2025-04-30", false, 
    [{ nome: "LUIZ ANTONIO DE OLIVEIRA", percentual: 100, cpf: "114.898.959-57" }],
    { extratoEnviado: "sim", faturamentoNacional: 9343.75, faturamentoTotal: 9343.75, distribuicaoLucros: 7007.81 }),
  
  criarEmpresa(942, "AOS CONSULTORIA LTDA", "60.640.039/0001-03", "2025-05-02", false, 
    [{ nome: "ARTHUR ORLANDO DOS SANTOS", percentual: 100, cpf: "073.966.999-08" }],
    { extratoEnviado: "sem_faturamento" }),
  
  criarEmpresa(961, "ARBIEAGLE CONSULTORIA LTDA", "61.005.664/0001-38", "2025-05-26", false, 
    [{ nome: "PEDRO HENRIQUE MACHADO TAKEMOTO", percentual: 100, cpf: "126.285.329-05" }]),
  
  criarEmpresa(974, "ASF16 CONSULTORIA LTDA", "61.280.484/0001-64", "2025-06-12", false, 
    [{ nome: "ALAN SOUSA FARIAS", percentual: 100, cpf: "169.035.697-90" }],
    { extratoEnviado: "sim", faturamentoNacional: 38638.00, faturamentoTotal: 38638.00, distribuicaoLucros: 28978.50 }),
  
  criarEmpresa(975, "AUSTRALIA TIPS LTDA", "61.348.567/0001-48", "2025-06-17", false, 
    [
      { nome: "ANTONIO ROBERTO RIBEIRO DE OLIVEIRA", percentual: 50, cpf: "169.445.197-63" },
      { nome: "LUCAS SOUZA DE LIMA", percentual: 50, cpf: "060.446.105-43" }
    ],
    { extratoEnviado: "sim", faturamentoNacional: 9203.62, faturamentoTotal: 9203.62, distribuicaoLucros: 6902.72 }),
  
  criarEmpresa(328, "BASILIO SERVICOS ADMINISTRATIVOS LTDA", "48.469.461/0001-34", "2022-10-31", false, 
    [{ nome: "Caroline Moreira Basilio", percentual: 100, cpf: "030.666.090-30" }]),
  
  criarEmpresa(428, "BET BROKER CONSULTORIA LTDA", "52.337.211/0001-18", "2023-09-27", false, 
    [
      { nome: "Carlos Vinicius Albuquerque", percentual: 33, cpf: "013.148.010-31" },
      { nome: "Matheus Laurent", percentual: 33, cpf: "013.264.760-50" },
      { nome: "Thiago Laurent", percentual: 33, cpf: "016.191.970-30" }
    ]),
  
  criarEmpresa(330, "BIEL PRODUCAO DE VIDEOS E TREINAMENTOS", "40.863.981/0001-15", "2021-02-16", true, 
    [{ nome: "Gabriel Guia Ferreira", percentual: 100, cpf: "169.324.937-56" }]),
  
  criarEmpresa(512, "BET MONEY ASSESSORIA LTDA", "53.842.560/0001-50", "2024-02-07", true, 
    [{ nome: "Geovane Rodrigo de Souza", percentual: 100, cpf: "700.600.304-02" }],
    { extratoEnviado: "sim", faturamentoNacional: 2879.56, faturamentoNotaFiscal: 15700.81, faturamentoTotal: 18580.37, distribuicaoLucros: 13935.28 }),
  
  criarEmpresa(472, "BM SPORTS LTDA", "53.213.675/0001-85", "2023-12-15", false, 
    [
      { nome: "Leonardo Amorim Medeiros", percentual: 50, cpf: "447.960.278-07" },
      { nome: "Luis Eduardo Ferrari Bezana", percentual: 50, cpf: "229.542.298-10" }
    ],
    { extratoEnviado: "sem_faturamento" }),
  
  criarEmpresa(536, "BC GONCALVES INVESTIMENTOS ESPORTIVOS LTDA", "54.890.040/0001-85", "2024-04-25", true, 
    [
      { nome: "BRENO ALVES GONÇALVES", percentual: 50, cpf: "146.677.297-24" },
      { nome: "Camila Narciso Nazario", percentual: 50, cpf: "138.670.927-10" }
    ],
    { extratoEnviado: "nao", faturamentoNotaFiscal: 22898.61, faturamentoTotal: 22898.61, distribuicaoLucros: 17173.96 }),
  
  criarEmpresa(537, "BEHLERS TIPS LTDA", "55.408.197/0001-94", "2024-06-05", false, 
    [{ nome: "Bruno Miguel Ehlers", percentual: 100, cpf: "023.677.700-93" }]),
  
  criarEmpresa(603, "BETINVEST CONSULTORIA LTDA", "55.845.851/0001-27", "2024-07-08", false, 
    [{ nome: "Eduado Lucht de Oliveira", percentual: 100, cpf: "147.682.367-74" }],
    { extratoEnviado: "sem_faturamento" }),
  
  criarEmpresa(671, "BORBA SOLUCOES EM INVESTIMENTOS LTDA", "57.588.663/0001-96", "2024-10-07", false, 
    [{ nome: "Geissiara de Borba Corrassa", percentual: 100, cpf: "030.750.450-63" }],
    { extratoEnviado: "sem_faturamento" }),
  
  criarEmpresa(697, "BDSINVEST LTDA", "57.796.337/0001-74", "2024-10-22", false, 
    [{ nome: "Gabriela Almeida Maia", percentual: 100, cpf: "029.950.723-80" }],
    { extratoEnviado: "sem_faturamento" }),
  
  criarEmpresa(718, "BOTFIX LTDA", "58.162.290/0001-50", "2024-11-20", false, 
    [{ nome: "JOAO VITOR DOS SANTOS ANDRADE", percentual: 100, cpf: "092.624.069-24" }],
    { extratoEnviado: "sim", faturamentoNacional: 32380.00, faturamentoTotal: 32380.00, distribuicaoLucros: 24285.00 }),
  
  criarEmpresa(728, "BINAO ASSESSORIA LTDA", "58.325.890/0001-91", "2024-12-03", true, 
    [{ nome: "JOAO PEDRO PEREIRA", percentual: 100, cpf: "151.949.776-89" }],
    { extratoEnviado: "nao", faturamentoNotaFiscal: 10100.75, faturamentoTotal: 10100.75, distribuicaoLucros: 7575.56 }),
  
  criarEmpresa(767, "BETMASTER LTDA", "59.144.045/0001-82", "2025-01-28", false, 
    [
      { nome: "PABLO HENRIQUE CAMARGO ARAUJO", percentual: 34, cpf: "521.536.548-23" },
      { nome: "GUSTAVO DE OLIVEIRA MORAES", percentual: 33, cpf: "502.935.378-01" },
      { nome: "VICTOR HENRIQUE SOUZA ARAUJO", percentual: 33, cpf: "518.597.278-59" }
    ]),
  
  criarEmpresa(806, "BET EXTRA LTDA", "59.296.663/0001-48", "2025-02-05", true, 
    [{ nome: "MATHEUS PEREIRA DE SOUZA", percentual: 100, cpf: "422.275.018-20" }]),
  
  criarEmpresa(807, "BETA CONSULTORIA LTDA", "59.632.271/0001-02", "2025-02-24", false, 
    [{ nome: "ROBERTO CANTINHO DE MELO NETO", percentual: 100, cpf: "101.048.224-65" }]),
  
  criarEmpresa(808, "BLUESKY LTDA", "59.512.090/0001-42", "2025-02-17", false, 
    [{ nome: "RAFAEL BORGES DORNELLES DUARTE", percentual: 100, cpf: "042.231.640-74" }]),
  
  criarEmpresa(336, "CAOS TIPS LTDA", "49.883.831/0001-48", "2023-03-10", true, 
    [{ nome: "Jonas Cardoso Vriesman", percentual: 100, cpf: "107.879.669-67" }],
    { extratoEnviado: "nao", faturamentoNotaFiscal: 6419.10, faturamentoTotal: 6419.10, distribuicaoLucros: 4814.32 }),
  
  criarEmpresa(338, "CBG SERVICOS LTDA", "50.064.785/0001-34", "2023-03-24", false, 
    [{ nome: "Victor Guilherme Braga Araujo", percentual: 100, cpf: "050.040.883-14" }],
    { extratoEnviado: "sim", faturamentoNacional: 17055.30, faturamentoTotal: 17055.30, distribuicaoLucros: 12791.48 }),
  
  criarEmpresa(339, "C.B SERVICOS ADMINISTRATIVOS LTDA", "48.678.654/0001-03", "2022-11-21", true, 
    [{ nome: "Gustavo Barbosa Correa", percentual: 100, cpf: "156.366.307-43" }],
    { extratoEnviado: "nao", faturamentoNotaFiscal: 129771.81, faturamentoTotal: 129771.81, distribuicaoLucros: 97328.86 }),
  
  criarEmpresa(539, "CF APOSTAS ESPORTIVAS LTDA", "55.085.383/0001-30", "2024-05-10", false, 
    [{ nome: "Francisco Cassio Fernandes Costa", percentual: 100, cpf: "016.890.354-71" }],
    { extratoEnviado: "sim", faturamentoNacional: 7925.00, faturamentoTotal: 7925.00, distribuicaoLucros: 5943.75 }),
  
  criarEmpresa(687, "CRBR INVESTIMENTOS E CONSULTORIA", "52.847.834/0001-30", "2024-10-01", false, 
    [{ nome: "Cristiano Rodrigo Borges Ramos", percentual: 100, cpf: "329.551.808-40" }],
    { extratoEnviado: "sim", faturamentoNacional: 37800.00, faturamentoTotal: 37800.00, distribuicaoLucros: 28350.00 }),
  
  criarEmpresa(745, "C&C SOLUCOES EMPRESARIAIS LTDA", "59.009.433/0001-50", "2025-01-21", false, 
    [{ nome: "EDERNEI CUNHA CORRASSA", percentual: 100, cpf: "025.815.720-86" }],
    { extratoEnviado: "sim", faturamentoNacional: 7365.00, faturamentoTotal: 7365.00, distribuicaoLucros: 5523.75 }),
  
  criarEmpresa(879, "CYPHER CLUB LTDA", "60.141.642/0001-32", "2025-03-28", false, 
    [{ nome: "GUSTAVO OLIVEIRA SILVA", percentual: 100, cpf: "132.653.956-69" }],
    { extratoEnviado: "sim", faturamentoNacional: 7422.70, faturamentoTotal: 7422.70, distribuicaoLucros: 5567.02 }),
  
  criarEmpresa(893, "CAIO PEPE LTDA", "60.359.730/0001-05", "2025-04-11", true, 
    [{ nome: "CAIO PEPE CRISOSTOMO", percentual: 100, cpf: "026.214.565-02" }],
    { extratoEnviado: "nao", faturamentoNotaFiscal: 6500.00, faturamentoTotal: 6500.00, distribuicaoLucros: 4875.00 }),
  
  criarEmpresa(343, "FLAVIA DANTAS MANZATO SACRAMONI", "34.357.064/0001-66", "2019-07-29", false, 
    [{ nome: "Flavia Dantas Manzato da Silva", percentual: 100, cpf: "398.908.508-50" }],
    { extratoEnviado: "sem_faturamento" }),
  
  criarEmpresa(546, "FRANCA ASSESSORIA LTDA", "54.804.163/0001-56", "2024-04-19", false, 
    [{ nome: "Diogo Alan Franca Luz", percentual: 100, cpf: "109.159.879-70" }],
    { extratoEnviado: "sim", faturamentoNacional: 7000.00, faturamentoTotal: 7000.00, distribuicaoLucros: 5250.00 }),
  
  criarEmpresa(496, "FILUMA CONSULTORIA LTDA", "53.719.833/0001-73", "2024-01-30", false, 
    [{ nome: "Felipe Ramos Duarte", percentual: 100, cpf: "481.778.088-69" }]),
  
  criarEmpresa(734, "FIFACK CONSULTORIA ESPORTIVA LTDA", "58.509.104/0001-06", "2024-12-18", false, 
    [{ nome: "FRANKLIN SILVA FRAGA", percentual: 100, cpf: "091.717.716-97" }],
    { extratoEnviado: "sim", faturamentoNacional: 5022.52, faturamentoTotal: 5022.52, distribuicaoLucros: 3766.89 }),
  
  criarEmpresa(816, "FATUCH INVEST LTDA", "59.631.089/0001-37", "2025-02-24", false, 
    [{ nome: "GABRIEL FATUCH", percentual: 100, cpf: "080.958.629-08" }],
    { extratoEnviado: "sim", faturamentoNacional: 28345.56, faturamentoTotal: 28345.56, distribuicaoLucros: 21259.17 }),
  
  criarEmpresa(842, "FIRSTSTEP CONSULTORIA LTDA", "59.647.211/0001-63", "2025-02-25", true, 
    [{ nome: "LUIS FERNANDO GERALDO", percentual: 100, cpf: "150.098.497-39" }],
    { extratoEnviado: "sim", faturamentoNotaFiscal: 58441.62, faturamentoTotal: 58441.62, distribuicaoLucros: 43831.21 }),
  
  criarEmpresa(897, "FALCONE CONSULT LTDA", "60.239.056/0001-25", "2025-04-03", false, 
    [{ nome: "LEONARDO FALCONE VIEIRA", percentual: 100, cpf: "471.964.128-85" }],
    { extratoEnviado: "sim", faturamentoNacional: 8453.00, faturamentoTotal: 8453.00, distribuicaoLucros: 6339.75 }),
  
  criarEmpresa(1038, "FCS INVEST LTDA", "62.388.257/0001-10", "2025-08-25", false, 
    [{ nome: "FABRICIO CESAR DE SOUZA", percentual: 100, cpf: "083.512.896-20" }],
    { extratoEnviado: "sim", faturamentoNacional: 18084.79, faturamentoTotal: 18084.79, distribuicaoLucros: 13563.59 }),
  
  criarEmpresa(1054, "FIORINDO CONSULTORIA LTDA", "62.571.485/0001-20", "2025-09-04", false, 
    [{ nome: "SAULO MARCELO FIORINDO FILHO", percentual: 100, cpf: "132.169.076-27" }],
    { extratoEnviado: "sim", faturamentoNacional: 10000.00, faturamentoTotal: 10000.00, distribuicaoLucros: 7500.00 }),
  
  criarEmpresa(1114, "F. J. OLIVEIRA CAPITAL LTDA", "63.606.904/0001-85", "2025-11-11", false, 
    [{ nome: "FABIO JOSE DE OLIVEIRA", percentual: 100, cpf: "087.925.964-79" }],
    { extratoEnviado: "sim", faturamentoNacional: 11300.00, faturamentoTotal: 11300.00, distribuicaoLucros: 8475.00 }),
  
  criarEmpresa(1175, "FCONSOLE CONSULTORIA ESPORTIVA LTDA", "64.685.814/0001-90", "2026-01-23", false, 
    [{ nome: "FELIPE CONSOLE DE OLIVEIRA", percentual: 100, cpf: "143.558.697-25" }],
    { extratoEnviado: "sim", faturamentoNacional: 74350.90, faturamentoTotal: 74350.90, distribuicaoLucros: 55763.18 }),
  
  criarEmpresa(414, "GL INVESTIMENTOS LTDA", "51.798.413/0001-02", "2023-08-14", false, 
    [{ nome: "Gabriel Lopes Gonçalves", percentual: 100, cpf: "450.470.168-54" }]),
  
  criarEmpresa(347, "GS INVESTIMENTOS LTDA", "47.782.012/0001-89", "2022-08-31", true, 
    [{ nome: "Guilherme da Silveira Santana", percentual: 100, cpf: "189.435.597-04" }],
    { extratoEnviado: "nao", faturamentoNotaFiscal: 19116.06, faturamentoTotal: 19116.06, distribuicaoLucros: 14337.05 }),
  
  criarEmpresa(663, "GUNDOR ASSESSORIA LTDA", "57.437.096/0001-77", "2024-09-25", false, 
    [{ nome: "LUCAS ZANQUETTA DE OLIVEIRA LIMA", percentual: 100, cpf: "511.347.658-78" }],
    { extratoEnviado: "sim", faturamentoNacional: 19283.50, faturamentoTotal: 19283.50, distribuicaoLucros: 14462.63 }),
  
  criarEmpresa(712, "GBC INVESTIMENTOS LTDA", "57.930.258/0001-04", "2024-11-01", true, 
    [{ nome: "GUILHERME BARBOZA CORREA", percentual: 100, cpf: "167.216.967-46" }],
    { extratoEnviado: "nao", faturamentoNotaFiscal: 20175.63, faturamentoTotal: 20175.63, distribuicaoLucros: 15131.72 }),
  
  criarEmpresa(751, "GEORGE TIPS ASSESSORIA LTDA", "59.009.199/0001-61", "2025-01-21", false, 
    [{ nome: "GEORGE LUCAS MENEGHETTI DE OLIVEIRA", percentual: 100, cpf: "034.539.020-25" }],
    { extratoEnviado: "sim", faturamentoNacional: 8173.00, faturamentoTotal: 8173.00, distribuicaoLucros: 6129.75 }),
  
  criarEmpresa(857, "GR INVESTIMENTOS ESPORTIVOS LTDA", "59.521.175/0001-97", "2025-02-18", false, 
    [{ nome: "GUILHERME GUSTAVO AGNELLI RAMOS", percentual: 100, cpf: "094.593.029-12" }],
    { extratoEnviado: "sim", faturamentoNacional: 39863.89, faturamentoTotal: 39863.89, distribuicaoLucros: 29897.92 }),
  
  criarEmpresa(916, "GREEN MASTERS CONSULTORIA LTDA", "60.478.269/0001-00", "2025-04-22", false, 
    [{ nome: "DANIEL ALVES NUNES", percentual: 100, cpf: "060.806.755-52" }],
    { extratoEnviado: "sim", faturamentoNacional: 2088.52, faturamentoTotal: 2088.52, distribuicaoLucros: 1566.39 }),
  
  criarEmpresa(913, "GUSTAVO BARBOSA CHAVES POSSAS - CONSULTORIA", "49.444.162/0001-08", "2025-04-01", true, 
    [{ nome: "GUSTAVO BARBOSA CHAVES POSSAS", percentual: 100, cpf: "121.146.166-14" }],
    { extratoEnviado: "nao", faturamentoNotaFiscal: 22000.00, faturamentoTotal: 22000.00, distribuicaoLucros: 16500.00 }),
  
  criarEmpresa(947, "GABRIEL JOLY DA SILVEIRA LTDA", "54.344.521/0001-95", "2025-05-01", false, 
    [{ nome: "GABRIEL JOLY DA SILVEIRA", percentual: 100, cpf: "093.750.959-08" }],
    { extratoEnviado: "sim", faturamentoNacional: 12720.00, faturamentoTotal: 12720.00, distribuicaoLucros: 9540.00 }),
  
  criarEmpresa(952, "GOUVEIA CONTAS LTDA", "60.775.523/0001-31", "2025-05-12", false, 
    [{ nome: "ERICK GOUVEIA LIMA", percentual: 100, cpf: "148.058.816-40" }],
    { extratoEnviado: "sim", faturamentoNacional: 5000.00, faturamentoTotal: 5000.00, distribuicaoLucros: 3750.00 }),
  
  criarEmpresa(953, "GRD INVEST LTDA", "60.665.609/0001-01", "2025-05-05", false, 
    [{ nome: "RAFAEL DA SILVA COSTA", percentual: 100, cpf: "142.747.817-12" }],
    { extratoEnviado: "sim", faturamentoNacional: 6008.67, faturamentoTotal: 6008.67, distribuicaoLucros: 4506.50 }),
  
  criarEmpresa(999, "GERSIN LTDA", "61.696.149/0001-41", "2025-07-11", false, 
    [{ nome: "GERSON MENDES MOREIRA NETO", percentual: 100, cpf: "075.309.591-23" }],
    { extratoEnviado: "sim", faturamentoNacional: 9716.45, faturamentoTotal: 9716.45, distribuicaoLucros: 7287.34 }),
  
  criarEmpresa(1156, "GLOW FEMME LTDA", "64.341.186/0001-25", "2026-01-06", false, 
    [{ nome: "GIOVANA VICTORIA RODRIGUES AGUILAR", percentual: 100, cpf: "484.217.688-16" }],
    { extratoEnviado: "sim", faturamentoNacional: 35000.00, faturamentoTotal: 35000.00, distribuicaoLucros: 26250.00 }),
  
  criarEmpresa(413, "HEISA TIPS CONSULTORIA LTDA", "51.739.584/0001-52", "2023-08-09", true, 
    [{ nome: "Fabio da Rosa Jeremias", percentual: 100, cpf: "108.348.289-01" }],
    { extratoEnviado: "sim", faturamentoNacional: 20341.70, faturamentoNotaFiscal: 2791.59, faturamentoExterior: 1695.48, faturamentoTotal: 24828.77, distribuicaoLucros: 18621.58 }),
  
  criarEmpresa(680, "HBR GESTAO FINANCEIRA LTDA", "57.684.370/0001-02", "2024-10-14", false, 
    [{ nome: "Heber Barbosa Rodrigues", percentual: 100, cpf: "073.383.671-24" }],
    { extratoEnviado: "sim", faturamentoNacional: 27115.18, faturamentoTotal: 27115.18, distribuicaoLucros: 20336.38 }),
  
  criarEmpresa(823, "H TECH INVEST LTDA", "59.304.363/0001-63", "2025-02-05", false, 
    [{ nome: "SAMUEL HONORIO FERREIRA GOMES DOS SANTOS", percentual: 100, cpf: "147.353.986-27" }],
    { extratoEnviado: "sim", faturamentoNacional: 37625.00, faturamentoTotal: 37625.00, distribuicaoLucros: 28218.75 }),
  
  criarEmpresa(977, "HILST ANALYTICS LTDA", "61.330.673/0001-02", "2025-06-16", true, 
    [{ nome: "MARCELO HILST MARTINS", percentual: 100, cpf: "031.167.339-29" }],
    { extratoEnviado: "sim", faturamentoNacional: 4000.00, faturamentoTotal: 4000.00, distribuicaoLucros: 3000.00 }),
  
  criarEmpresa(380, "O MAGO NBA MAGIC LTDA", "47.731.215/0001-46", "2022-08-26", false, 
    [{ nome: "Thiago Laurent", percentual: 100, cpf: "016.161.970-30" }],
    { extratoEnviado: "sim", faturamentoNacional: 76416.83, faturamentoTotal: 76416.83, distribuicaoLucros: 57312.62 }),
  
  criarEmpresa(480, "OR CONSULTORIA ESPORTIVA LTDA", "53.283.655/0001-80", "2023-12-21", true, 
    [{ nome: "Otavio Rotunno Rojas Lima", percentual: 100, cpf: "022.740.970-11" }],
    { extratoEnviado: "nao", faturamentoNotaFiscal: 289.80, faturamentoTotal: 289.80, distribuicaoLucros: 217.35 }),
  
  criarEmpresa(371, "M. DE OLIVEIRA COSTA LTDA", "49.196.136/0001-08", "2023-01-16", false, 
    [{ nome: "Maquissuel de Oliveira Costa", percentual: 100, cpf: "095.108.296-50" }],
    { extratoEnviado: "sim", faturamentoNacional: 19500.00, faturamentoTotal: 19500.00, distribuicaoLucros: 14625.00 }),
  
  criarEmpresa(372, "MAISVALOR INVEST. ADMINISTRACAO LTDA", "48.765.322/0001-58", "2022-11-30", true, 
    [{ nome: "Lucas Rafael Lerner", percentual: 100, cpf: "026.836.290-44" }],
    { extratoEnviado: "nao", faturamentoNotaFiscal: 300.00, faturamentoTotal: 300.00, distribuicaoLucros: 225.00 }),
  
  criarEmpresa(373, "MARINCEK ESPORTES LTDA", "48.984.592/0001-50", "2022-12-27", false, 
    [{ nome: "Bruno Henrique Marincek", percentual: 100, cpf: "454.907.998-38" }],
    { extratoEnviado: "sim", faturamentoNacional: 3158.13, faturamentoTotal: 3158.13, distribuicaoLucros: 2368.60 }),
  
  criarEmpresa(464, "MOVE GOLD CONSULTORIA LTDA", "52.952.973/0001-24", "2023-11-21", false, 
    [{ nome: "Sara Indiara de Brito Dal Castel", percentual: 100, cpf: "033.465.920-57" }],
    { extratoEnviado: "sim", faturamentoNacional: 55728.36, faturamentoTotal: 55728.36, distribuicaoLucros: 41796.27 }),
  
  criarEmpresa(486, "MPARTNER CONS FINAA LTDA", "53.495.129/0001-84", "2024-01-15", false, 
    [{ nome: "Luciano Roni Martins", percentual: 100, cpf: "029.083.180-67" }],
    { extratoEnviado: "sim", faturamentoNacional: 3500.00, faturamentoTotal: 3500.00, distribuicaoLucros: 2625.00 }),
  
  criarEmpresa(560, "MF365 LTDA", "55.277.249/0001-30", "2024-05-25", false, 
    [{ nome: "MICHEL FIGUEIREDO VIEIRA", percentual: 100, cpf: "071.702.055-05" }],
    { extratoEnviado: "sim", faturamentoNacional: 3000.00, faturamentoTotal: 3000.00, distribuicaoLucros: 2250.00 }),
  
  criarEmpresa(601, "MEGA GOLD LTDA", "55.761.611/0001-44", "2024-07-02", false, 
    [{ nome: "JEAN DE OLIVEIRA", percentual: 100, cpf: "033.516.490-02" }],
    { extratoEnviado: "sim", faturamentoNacional: 33969.96, faturamentoTotal: 33969.96, distribuicaoLucros: 25477.47 }),
  
  criarEmpresa(604, "MG NUNES LTDA", "55.849.671/0001-13", "2024-07-08", false, 
    [{ nome: "ANDRO NUNES DE SOUZA", percentual: 100, cpf: "034.318.640-31" }],
    { extratoEnviado: "sim", faturamentoNacional: 10000.00, faturamentoTotal: 10000.00, distribuicaoLucros: 7500.00 }),
  
  criarEmpresa(608, "MG CARDIAS LTDA", "55.977.299/0001-20", "2024-07-17", false, 
    [{ nome: "CARLOS EDUARDO DA SILVA CARDIAS JUNIOR", percentual: 100, cpf: "005.725.721-31" }],
    { extratoEnviado: "sim", faturamentoNacional: 9000.00, faturamentoTotal: 9000.00, distribuicaoLucros: 6750.00 }),
  
  criarEmpresa(615, "MIDAS INVEST LTDA", "56.004.446/0001-49", "2024-07-19", false, 
    [{ nome: "BARTOLOMEU ALEXANDRINO NERIS NETO", percentual: 100, cpf: "067.970.965-70" }],
    { extratoEnviado: "sim", faturamentoNacional: 34431.57, faturamentoTotal: 34431.57, distribuicaoLucros: 25823.68 }),
  
  criarEmpresa(627, "MAGREEN CONSULTORIA ESPORTIVA LTDA", "56.429.910/0001-49", "2024-08-09", true, 
    [{ nome: "BRENO HENRIQUE ARIEIRA CONSTANTINO", percentual: 100, cpf: "149.817.687-96" }],
    { extratoEnviado: "nao", faturamentoNotaFiscal: 34711.79, faturamentoTotal: 34711.79, distribuicaoLucros: 26033.84 }),
  
  criarEmpresa(675, "MARINHO PUNT ASSESSORIA LTDA", "57.611.167/0001-06", "2024-10-08", false, 
    [{ nome: "Felipe Marinho Alves Dias", percentual: 100, cpf: "944.187.802-20" }],
    { extratoEnviado: "sim", faturamentoNacional: 125000.00, faturamentoTotal: 125000.00, distribuicaoLucros: 93750.00 }),
  
  criarEmpresa(736, "MIKA CONSULTORIA LTDA", "58.518.355/0001-57", "2024-12-19", true, 
    [{ nome: "MIKAEL IZIDRO", percentual: 100, cpf: "031.536.870-56" }],
    { extratoEnviado: "nao", faturamentoNotaFiscal: 5417.93, faturamentoTotal: 5417.93, distribuicaoLucros: 4063.45 }),
  
  criarEmpresa(870, "MJMV LTDA", "60.081.394/0001-81", "2025-03-25", false, 
    [
      { nome: "MAURICIO BENICIO DA SILVA JUNIOR", percentual: 30, cpf: "009.593.612-27" },
      { nome: "MARCOS VINNICIUS SANDES DA SILVA", percentual: 70, cpf: "009.593.572-03" }
    ],
    { extratoEnviado: "sim", faturamentoNacional: 18548.00, faturamentoTotal: 18548.00, distribuicaoLucros: 13911.00 }),
  
  criarEmpresa(914, "MARIOTTI TECH LTDA", "60.477.507/0001-62", "2025-04-22", false, 
    [{ nome: "LUIS FERNANDO MARIOTTI PAIVA", percentual: 100, cpf: "455.052.988-18" }],
    { extratoEnviado: "sim", faturamentoNacional: 122200.00, faturamentoTotal: 122200.00, distribuicaoLucros: 91650.00 }),
  
  criarEmpresa(1051, "MATHEUS AGUIAR CONSULTORIA LTDA", "58.840.607/0001-60", "2025-08-01", true, 
    [{ nome: "MATHEUS DE AGUIAR BARBOSA", percentual: 100, cpf: "168.331.597-93" }],
    { extratoEnviado: "nao", faturamentoNotaFiscal: 16658.21, faturamentoTotal: 16658.21, distribuicaoLucros: 12493.66 }),
  
  criarEmpresa(1102, "MOJAK CONSULTORIA LTDA", "63.248.043/0001-00", "2025-10-17", false, 
    [
      { nome: "BRYAN DE ASSIS VIEGAS", percentual: 33.33, cpf: "548.486.978-16" },
      { nome: "MARIA SHISLEY DE ASSIS", percentual: 33.33, cpf: "251.850.008-13" },
      { nome: "DENILSON PEREIRA VIEGAS", percentual: 33.33, cpf: "181.728.078-30" }
    ],
    { extratoEnviado: "sim", faturamentoNacional: 19000.00, faturamentoTotal: 19000.00, distribuicaoLucros: 14250.00 }),
  
  criarEmpresa(1116, "MENDES CONSUTORIA LTDA", "63.598.583/0001-14", "2025-11-10", false, 
    [{ nome: "LUCAS PEREIRA MENDES", percentual: 100, cpf: "700.042.301-32" }],
    { extratoEnviado: "sim", faturamentoNacional: 12837.00, faturamentoTotal: 12837.00, distribuicaoLucros: 9627.75 }),
  
  criarEmpresa(1117, "MASTER MELLO CONSULTORIA ESPORTIVA LTDA", "63.594.937/0001-52", "2025-11-10", false, 
    [{ nome: "EVANDER MELLO DO AMARAL", percentual: 100, cpf: "013.878.320-93" }],
    { extratoEnviado: "sim", faturamentoNacional: 17127.00, faturamentoTotal: 17127.00, distribuicaoLucros: 12845.25 }),
  
  criarEmpresa(1128, "MATT FINANCES LTDA", "63.848.377/0001-15", "2025-11-27", false, 
    [{ nome: "MATTEO VANIN", percentual: 100, cpf: "086.152.719-41" }],
    { extratoEnviado: "sim", faturamentoNacional: 14000.00, faturamentoTotal: 14000.00, distribuicaoLucros: 10500.00 }),
  
  criarEmpresa(1131, "M.H. GROUP LTDA", "63.847.238/0001-77", "2025-11-27", false, 
    [{ nome: "MANOEL HENRIQUE SOUZA MARTINS RIBEIRO", percentual: 100, cpf: "502.182.998-00" }],
    { extratoEnviado: "sim", faturamentoNacional: 21000.00, faturamentoTotal: 21000.00, distribuicaoLucros: 15750.00 }),
  
  criarEmpresa(1160, "MJB CONSULTORIA LTDA", "64.514.348/0001-80", "2026-01-15", false, 
    [{ nome: "MATHEUS JOSUE BATISTA DE OLIVEIRA", percentual: 100, cpf: "013.691.979-00" }],
    { extratoEnviado: "sim", faturamentoNacional: 66262.57, faturamentoTotal: 66262.57, distribuicaoLucros: 49696.93 }),
  
  criarEmpresa(1161, "MS Gestão Financeira LTDA", "64.561.649/0001-64", "2026-01-13", false, 
    [
      { nome: "ADRIEL MACHADO SANTOS", percentual: 50, cpf: "091.085.905-16" },
      { nome: "JADIEL MACHADO SANTOS", percentual: 50, cpf: "091.086.045-92" }
    ],
    { extratoEnviado: "sim", faturamentoNacional: 18000.00, faturamentoTotal: 18000.00, distribuicaoLucros: 13500.00 }),
  
  criarEmpresa(1172, "MUN RA CONSULTORIA LTDA", "64.719.382/0001-90", "2026-01-26", false, 
    [{ nome: "FRANCISCO CORREA DE TATAGIBA JUNIOR", percentual: 100, cpf: "163.532.997-37" }],
    { extratoEnviado: "sim", faturamentoNacional: 2080.00, faturamentoTotal: 2080.00, distribuicaoLucros: 1560.00 }),
  ...EMPRESAS_EXTRAS,
];
