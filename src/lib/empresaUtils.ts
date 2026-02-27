import { Empresa, MesKey, isEmpresaBaixadaVisivel } from "@/types/fiscal";

const MES_INDEX: Record<MesKey, number> = {
  janeiro: 0, fevereiro: 1, marco: 2,
  abril: 3, maio: 4, junho: 5,
  julho: 6, agosto: 7, setembro: 8,
  outubro: 9, novembro: 10, dezembro: 11,
};

/**
 * Filtra empresas visíveis para o mês selecionado.
 * Aplica regras de início de competência e empresa baixada.
 */
export function filtrarEmpresasVisiveis(empresas: Empresa[], mesSelecionado: MesKey, anoBase = 2026): Empresa[] {
  return empresas.filter((e) => {
    // Filtrar por início da competência
    if (e.inicioCompetencia) {
      const inicio = new Date(e.inicioCompetencia);
      if (inicio.getFullYear() === anoBase) {
        if (MES_INDEX[mesSelecionado] < inicio.getMonth()) return false;
      } else if (inicio.getFullYear() > anoBase) {
        return false;
      }
    }

    // Filtrar empresas baixadas
    if (e.dataBaixa) {
      if (!isEmpresaBaixadaVisivel(e.dataBaixa, mesSelecionado)) return false;
    }

    return true;
  });
}
