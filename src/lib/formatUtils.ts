import type { MesKey } from "@/types/fiscal";

const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(value: number): string {
  return brlFormatter.format(value);
}

const MES_INDEX: Record<MesKey, number> = {
  janeiro: 1, fevereiro: 2, marco: 3,
  abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9,
  outubro: 10, novembro: 11, dezembro: 12,
};

export function getCompetenciaAtual(mesSelecionado: MesKey): string {
  const mes = MES_INDEX[mesSelecionado];
  return `2026-${String(mes).padStart(2, "0")}`;
}
