import { useState, useCallback } from "react";
import { RefreshCw, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppHeader } from "@/components/AppHeader";
import { UploadArea } from "@/components/comparativo/UploadArea";
import { ComparativoHeroKPI } from "@/components/comparativo/ComparativoHeroKPI";
import { ComparativoKPICards } from "@/components/comparativo/ComparativoKPICards";
import { QuarterlyComparisonChart } from "@/components/comparativo/QuarterlyComparisonChart";
import { TaxBreakdownChart } from "@/components/comparativo/TaxBreakdownChart";
import { MonthlyPISCOFINSChart } from "@/components/comparativo/MonthlyPISCOFINSChart";
import { ComparativoTable } from "@/components/comparativo/ComparativoTable";
import type { ComparativoData } from "@/types/comparativo";

export default function ComparativoTributario() {
  const [data, setData] = useState<ComparativoData | null>(null);

  const handleReset = useCallback(() => setData(null), []);
  const handleExportPDF = useCallback(() => window.print(), []);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Comparativo Tributário"
        subtitle="Lucro Presumido vs. Lucro Real"
        showBack
        backTo="/"
        breadcrumbs={[
          { label: "Portal", href: "/" },
          { label: "Comparativo Tributário" },
        ]}
      />

      {!data ? (
        <main className="mx-auto max-w-5xl px-4 py-10">
          <UploadArea onDataParsed={setData} />
        </main>
      ) : (
        <>
          {/* Floating actions */}
          <div className="fixed bottom-6 right-6 z-50 flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={handleReset} className="shadow-lg glass">
              <RefreshCw className="mr-1 h-4 w-4" /> Novo Upload
            </Button>
            <Button size="sm" onClick={handleExportPDF} className="shadow-lg header-gradient text-primary-foreground">
              <Printer className="mr-1 h-4 w-4" /> Exportar PDF
            </Button>
          </div>

          <main className="mx-auto max-w-6xl px-4 py-8 space-y-8 animate-slide-up">
            <ComparativoHeroKPI data={data} />
            <ComparativoKPICards data={data} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <QuarterlyComparisonChart data={data} />
              <TaxBreakdownChart data={data} />
            </div>

            <MonthlyPISCOFINSChart data={data} />
            <ComparativoTable data={data} />

            <footer className="text-center py-8 border-t border-border print:hidden">
              <p className="text-xs text-muted-foreground">
                Relatório gerado com base nos dados enviados via Excel
              </p>
            </footer>
          </main>
        </>
      )}
    </div>
  );
}
