import { useState } from "react";
import { useHonorarios, MesKey, MES_LABELS } from "@/hooks/useHonorarios";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { HonorariosTable } from "@/components/HonorariosTable";
import { HonorariosDashboard } from "@/components/HonorariosDashboard";
import { HonorariosEmpresaDialog } from "@/components/HonorariosEmpresaDialog";
import { SalarioMinimoDialog } from "@/components/SalarioMinimoDialog";
import { BomControleSyncButton } from "@/components/BomControleSyncButton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, Plus, Settings, Download } from "lucide-react";
import { exportHonorariosExcel } from "@/lib/exportExcel";
import type { HonorarioEmpresa } from "@/hooks/useHonorarios";

const MES_INDEX: Record<string, number> = {
  janeiro: 0, fevereiro: 1, marco: 2, abril: 3,
  maio: 4, junho: 5, julho: 6, agosto: 7,
  setembro: 8, outubro: 9, novembro: 10, dezembro: 11,
};

export default function Honorarios() {
  const { canEdit } = useModulePermissions("honorarios-contmax");
  const {
    empresas, loading, salarioMinimo, empresasDisponiveis,
    addEmpresa, updateEmpresa, deleteEmpresa, updateMesData,
    getMesData, calcularValores, updateSalarioMinimo,
  } = useHonorarios();

  const [mes, setMes] = useState<MesKey>("janeiro");
  const [search, setSearch] = useState("");
  const [empresaDialogOpen, setEmpresaDialogOpen] = useState(false);
  const [salarioDialogOpen, setSalarioDialogOpen] = useState(false);
  const [editingEmpresa, setEditingEmpresa] = useState<HonorarioEmpresa | null>(null);

  // Filters
  const [filtroBoleto, setFiltroBoleto] = useState<"todos" | "sim" | "nao">("todos");
  const [filtroNF, setFiltroNF] = useState<"todos" | "sim" | "nao">("todos");
  const [somenteAberto, setSomenteAberto] = useState(false);

  const filtered = empresas
    .filter((e) => {
      if (!e.empresa_nome.toLowerCase().includes(search.toLowerCase())) return false;
      if (mes !== "fechamento") {
        const mesInicialIdx = MES_INDEX[e.mes_inicial || "janeiro"] ?? 0;
        if (MES_INDEX[mes] < mesInicialIdx) return false;
      }
      if (filtroBoleto === "sim" && e.nao_emitir_boleto) return false;
      if (filtroBoleto === "nao" && !e.nao_emitir_boleto) return false;
      if (filtroNF === "sim" && !e.emitir_nf) return false;
      if (filtroNF === "nao" && e.emitir_nf) return false;
      if (somenteAberto && getMesData(e, mes).data_pagamento) return false;
      return true;
    })
    .sort((a, b) => a.empresa_nome.localeCompare(b.empresa_nome, "pt-BR"));

  const handleExport = () => {
    exportHonorariosExcel(filtered, MES_LABELS[mes], (emp) => {
      const v = calcularValores(emp as HonorarioEmpresa, mes);
      const md = getMesData(emp as HonorarioEmpresa, mes);
      return {
        ...v,
        numFuncionarios: md.num_funcionarios,
        servicosExtras: md.servicos_extras,
        dataPagamento: md.data_pagamento,
      };
    });
  };

  if (loading) return <LoadingSkeleton variant="portal" />;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Honorários Mensal"
        subtitle="Contmax · 2026"
        showBack
        showLogout
        breadcrumbs={[{ label: "Portal", href: "/" }, { label: "Honorários Mensal" }]}
        actions={
          canEdit ? (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSalarioDialogOpen(true)}
                className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
              >
                <Settings className="mr-1 h-4 w-4" /> SM: {salarioMinimo.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setEditingEmpresa(null); setEmpresaDialogOpen(true); }}
                className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
              >
                <Plus className="mr-1 h-4 w-4" /> Incluir Empresa
              </Button>
            </div>
          ) : undefined
        }
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        <Tabs value={mes} onValueChange={(v) => setMes(v as MesKey)}>
          <TabsList>
            {(Object.keys(MES_LABELS) as MesKey[]).map((m) => (
              <TabsTrigger key={m} value={m}>{MES_LABELS[m]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <HonorariosDashboard
          empresas={filtered}
          mes={mes}
          calcularValores={calcularValores}
          getMesData={getMesData}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={filtroBoleto} onValueChange={(v) => setFiltroBoleto(v as any)}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Boleto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Boleto: Todos</SelectItem>
              <SelectItem value="sim">Boleto: Sim</SelectItem>
              <SelectItem value="nao">Boleto: Não</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filtroNF} onValueChange={(v) => setFiltroNF(v as any)}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue placeholder="Emitir NF" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">NF: Todos</SelectItem>
              <SelectItem value="sim">NF: Sim</SelectItem>
              <SelectItem value="nao">NF: Não</SelectItem>
            </SelectContent>
          </Select>

          <label className="flex items-center gap-1.5 text-sm cursor-pointer select-none">
            <Checkbox
              checked={somenteAberto}
              onCheckedChange={(v) => setSomenteAberto(!!v)}
            />
            Somente em aberto
          </label>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 h-4 w-4" /> Exportar Excel
            </Button>
            {canEdit && (
              <BomControleSyncButton
                empresas={filtered}
                mes={mes}
                calcularValores={calcularValores}
                canEdit={canEdit}
              />
            )}
            {canEdit && (
              <Button
                size="sm"
                onClick={() => { setEditingEmpresa(null); setEmpresaDialogOpen(true); }}
              >
                <Plus className="mr-1 h-4 w-4" /> Incluir Empresa
              </Button>
            )}
          </div>
        </div>

        <HonorariosTable
          empresas={filtered}
          mes={mes}
          salarioMinimo={salarioMinimo}
          canEdit={canEdit}
          calcularValores={calcularValores}
          getMesData={getMesData}
          onUpdateMes={updateMesData}
          onEdit={(emp) => { setEditingEmpresa(emp); setEmpresaDialogOpen(true); }}
          onDelete={deleteEmpresa}
        />
      </main>

      <HonorariosEmpresaDialog
        open={empresaDialogOpen}
        onOpenChange={setEmpresaDialogOpen}
        empresasDisponiveis={empresasDisponiveis}
        editingEmpresa={editingEmpresa}
        onSave={addEmpresa}
        onUpdate={updateEmpresa}
      />

      <SalarioMinimoDialog
        open={salarioDialogOpen}
        onOpenChange={setSalarioDialogOpen}
        currentValue={salarioMinimo}
        onSave={updateSalarioMinimo}
      />
    </div>
  );
}
