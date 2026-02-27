import * as XLSX from "xlsx";
import type { ComparativoData, RegimeData, TaxQuarterly, TaxMonthly } from "@/types/comparativo";

function parseNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.replace(/[R$\s.]/g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function findRowIndex(rows: unknown[][], keyword: string): number {
  return rows.findIndex(
    (row) =>
      row.some(
        (cell) =>
          typeof cell === "string" &&
          cell.trim().toUpperCase().includes(keyword.toUpperCase())
      )
  );
}

function extractQuarterly(rows: unknown[][], startRow: number): TaxQuarterly {
  // The value row is startRow + 2 (header row, date row, value row)
  const valueRow = rows[startRow + 2] ?? [];
  return {
    q1: parseNumber(valueRow[0]),
    q2: parseNumber(valueRow[1]),
    q3: parseNumber(valueRow[2]),
    q4: parseNumber(valueRow[3]),
  };
}

function extractMonthly(rows: unknown[][], startRow: number): TaxMonthly {
  const valueRow = rows[startRow + 2] ?? [];
  return {
    jan: parseNumber(valueRow[0]),
    feb: parseNumber(valueRow[1]),
    mar: parseNumber(valueRow[2]),
    apr: parseNumber(valueRow[3]),
    may: parseNumber(valueRow[4]),
    jun: parseNumber(valueRow[5]),
    jul: parseNumber(valueRow[6]),
    aug: parseNumber(valueRow[7]),
    sep: parseNumber(valueRow[8]),
    oct: parseNumber(valueRow[9]),
    nov: parseNumber(valueRow[10]),
    dec: parseNumber(valueRow[11]),
  };
}

function parseRegime(rows: unknown[][], sectionStart: number, sectionEnd: number): RegimeData {
  const section = rows.slice(sectionStart, sectionEnd);

  const irIdx = findRowIndex(section, "IR");
  const csllIdx = findRowIndex(section, "CSLL");
  const pisIdx = findRowIndex(section, "PIS");
  const cofinsIdx = findRowIndex(section, "COFINS");
  const totalIdx = findRowIndex(section, "TOTAL");

  const ir = irIdx >= 0 ? extractQuarterly(section, irIdx) : { q1: 0, q2: 0, q3: 0, q4: 0 };
  const csll = csllIdx >= 0 ? extractQuarterly(section, csllIdx) : { q1: 0, q2: 0, q3: 0, q4: 0 };
  const pis = pisIdx >= 0 ? extractMonthly(section, pisIdx) : { jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0 };
  const cofins = cofinsIdx >= 0 ? extractMonthly(section, cofinsIdx) : { jan: 0, feb: 0, mar: 0, apr: 0, may: 0, jun: 0, jul: 0, aug: 0, sep: 0, oct: 0, nov: 0, dec: 0 };

  let total = 0;
  if (totalIdx >= 0) {
    const totalRow = section[totalIdx + 1] ?? [];
    total = parseNumber(totalRow[0]);
  }

  return { ir, csll, pis, cofins, total };
}

export function parseComparativoExcel(file: File): Promise<ComparativoData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

        const lucroRealIdx = findRowIndex(rows, "LUCRO REAL");
        const lucroPresumidoIdx = findRowIndex(rows, "LUCRO PRESUMIDO");
        const diferencaIdx = findRowIndex(rows, "DIFERENÇA");

        if (lucroRealIdx < 0 || lucroPresumidoIdx < 0) {
          throw new Error("Formato inválido: não encontrou seções LUCRO REAL e LUCRO PRESUMIDO");
        }

        const lucroReal = parseRegime(rows, lucroRealIdx, lucroPresumidoIdx);
        const lucroPresumido = parseRegime(rows, lucroPresumidoIdx, diferencaIdx >= 0 ? diferencaIdx + 2 : rows.length);

        let economiaTotal = lucroPresumido.total - lucroReal.total;
        if (diferencaIdx >= 0) {
          const diffRow = rows[diferencaIdx + 1] ?? [];
          const parsedDiff = parseNumber(diffRow[0]);
          if (parsedDiff > 0) economiaTotal = parsedDiff;
        }

        const percentualReducao = lucroPresumido.total > 0
          ? (economiaTotal / lucroPresumido.total) * 100
          : 0;

        resolve({ lucroReal, lucroPresumido, economiaTotal, percentualReducao });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo"));
    reader.readAsArrayBuffer(file);
  });
}
