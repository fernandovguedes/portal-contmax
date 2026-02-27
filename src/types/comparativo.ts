export interface TaxQuarterly {
  q1: number; // Mar
  q2: number; // Jun
  q3: number; // Sep
  q4: number; // Dec
}

export interface TaxMonthly {
  jan: number;
  feb: number;
  mar: number;
  apr: number;
  may: number;
  jun: number;
  jul: number;
  aug: number;
  sep: number;
  oct: number;
  nov: number;
  dec: number;
}

export interface RegimeData {
  ir: TaxQuarterly;
  csll: TaxQuarterly;
  pis: TaxMonthly;
  cofins: TaxMonthly;
  total: number;
}

export interface ComparativoData {
  lucroReal: RegimeData;
  lucroPresumido: RegimeData;
  economiaTotal: number;
  percentualReducao: number;
}
