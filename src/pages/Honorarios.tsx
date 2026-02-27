import { useState } from "react";
import { useHonorarios, MesKey, MES_LABELS } from "@/hooks/useHonorarios";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { HonorariosTable } from "@/components/HonorariosTable";
import { HonorariosEmpresaDialog } from "@/components/HonorariosEmpresaDialog";
import { SalarioMinimoDialog } from "@/components/SalarioMinimoDialog";
import { BomControleSyncButton } from "@/components/BomControleSyncButton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Settings } from "lucide-react";
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

  const filtered = empresas.filter((e) => {
    if (!e.empresa_nome.toLowerCase().includes(search.toLowerCase())) return false;
    if (mes !== "fechamento") {
      const mesInicialIdx = MES_INDEX[e.mes_inicial || "janeiro"] ?? 0;
      if (MES_INDEX[mes] < mesInicialIdx) return false;
    }
    return true;
  });

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={mes} onValueChange={(v) => setMes(v as MesKey)}>
            <TabsList>
              {(Object.keys(MES_LABELS) as MesKey[]).map((m) => (
                <TabsTrigger key={m} value={m}>{MES_LABELS[m]}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
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
