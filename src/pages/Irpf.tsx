import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useModulePermissions } from "@/hooks/useModulePermissions";
import { useIrpf } from "@/hooks/useIrpf";
import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { IrpfDashboardCards } from "@/components/irpf/IrpfDashboardCards";
import { IrpfDeclaracoesTable } from "@/components/irpf/IrpfDeclaracoesTable";
import { IrpfPessoasTable } from "@/components/irpf/IrpfPessoasTable";
import { IrpfNovaPessoaDialog } from "@/components/irpf/IrpfNovaPessoaDialog";
import { toast } from "@/hooks/use-toast";

const ANOS = [2024, 2025, 2026];

export default function Irpf() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { canEdit, loading: permLoading } = useModulePermissions(`irpf-${orgSlug}`);

  const [orgInfo, setOrgInfo] = useState<{ id: string; nome: string } | null>(null);
  const [anoBase, setAnoBase] = useState(2025);
  const [novaPessoaOpen, setNovaPessoaOpen] = useState(false);

  useEffect(() => {
    if (!orgSlug) return;
    supabase
      .from("organizacoes")
      .select("id, nome")
      .eq("slug", orgSlug)
      .single()
      .then(({ data, error }) => {
        if (error) {
          toast({ title: "Erro ao carregar organização", description: error.message, variant: "destructive" });
          return;
        }
        if (data) setOrgInfo(data);
      });
  }, [orgSlug]);

  const {
    people, cases, docCounts, loading,
    createPersonAndCase, createCase, updateCaseInline,
  } = useIrpf(orgInfo?.id, anoBase);

  if (!orgInfo || permLoading) {
    return <LoadingSkeleton variant="portal" />;
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title={`IRPF ${orgInfo.nome}`}
        subtitle={`Declarações de Imposto de Renda — ${orgInfo.nome}`}
        showBack
        showLogout
        breadcrumbs={[{ label: "Portal", href: "/" }, { label: `IRPF ${orgInfo.nome}` }]}
        actions={
          <div className="flex items-center gap-2">
            <Select value={String(anoBase)} onValueChange={v => setAnoBase(Number(v))}>
              <SelectTrigger className="w-[100px] bg-white/10 border-white/20 text-primary-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANOS.map(a => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
            {canEdit && (
              <Button onClick={() => setNovaPessoaOpen(true)} className="bg-accent text-accent-foreground hover:bg-accent/90">
                <Plus className="mr-1 h-4 w-4" /> Nova Pessoa
              </Button>
            )}
          </div>
        }
      />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {loading ? (
          <LoadingSkeleton variant="portal" />
        ) : (
          <>
            <IrpfDashboardCards cases={cases} />

            <Tabs defaultValue="declaracoes">
              <TabsList>
                <TabsTrigger value="declaracoes">Declarações ({cases.length})</TabsTrigger>
                <TabsTrigger value="pessoas">Pessoas ({people.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="declaracoes" className="mt-4">
                <IrpfDeclaracoesTable
                  cases={cases}
                  docCounts={docCounts}
                  canEdit={canEdit}
                  orgSlug={orgSlug!}
                  onInlineUpdate={updateCaseInline}
                />
              </TabsContent>

              <TabsContent value="pessoas" className="mt-4">
                <IrpfPessoasTable
                  people={people}
                  cases={cases}
                  anoBase={anoBase}
                  canEdit={canEdit}
                  onCreateCase={createCase}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>

      <IrpfNovaPessoaDialog
        open={novaPessoaOpen}
        onOpenChange={setNovaPessoaOpen}
        orgSlug={orgSlug!}
        tenantId={orgInfo.id}
        onAddPerson={createPersonAndCase}
      />
    </div>
  );
}
