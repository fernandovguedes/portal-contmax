import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Plus, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { IrpfSource } from "@/types/irpf";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgSlug: string;
  tenantId: string;
  onAddPerson: (data: {
    nome: string; cpf: string; source: IrpfSource;
    email?: string; telefone?: string;
    pgEmpresaId?: string; pgSocioCpf?: string;
  }) => Promise<any>;
}

interface Socio {
  empresa_id: string;
  empresa_nome: string;
  empresa_cnpj: string;
  socio_cpf: string;
  socio_nome: string;
  socio_percentual: number;
}

export function IrpfNovaPessoaDialog({ open, onOpenChange, orgSlug, tenantId, onAddPerson }: Props) {
  const [tab, setTab] = useState(orgSlug === "pg" ? "pg" : orgSlug === "contmax" ? "contmax" : "avulso");
  const [searchPg, setSearchPg] = useState("");
  const [socios, setSocios] = useState<Socio[]>([]);
  const [loadingSocios, setLoadingSocios] = useState(false);
  const [adding, setAdding] = useState(false);

  // Avulso form
  const [avNome, setAvNome] = useState("");
  const [avCpf, setAvCpf] = useState("");
  const [avEmail, setAvEmail] = useState("");
  const [avTelefone, setAvTelefone] = useState("");

  useEffect(() => {
    if (!open) return;
    setTab(orgSlug === "pg" ? "pg" : orgSlug === "contmax" ? "contmax" : "avulso");
    setSearchPg("");
    setSocios([]);
    setAvNome(""); setAvCpf(""); setAvEmail(""); setAvTelefone("");
  }, [open, orgSlug]);

  const searchSocios = async () => {
    if (searchPg.length < 2) return;
    setLoadingSocios(true);
    const { data, error } = await supabase
      .from("pg_socios_view")
      .select("*")
      .eq("tenant_id", tenantId)
      .or(`socio_nome.ilike.%${searchPg}%,socio_cpf.ilike.%${searchPg}%,empresa_nome.ilike.%${searchPg}%`)
      .limit(50);

    if (error) {
      toast({ title: "Erro na busca", description: error.message, variant: "destructive" });
    } else {
      setSocios((data || []) as Socio[]);
    }
    setLoadingSocios(false);
  };

  const handleAddSocio = async (s: Socio) => {
    setAdding(true);
    await onAddPerson({
      nome: s.socio_nome,
      cpf: s.socio_cpf,
      source: orgSlug === "contmax" ? "CONTMAX" : "PG",
      pgEmpresaId: s.empresa_id,
      pgSocioCpf: s.socio_cpf,
    });
    setAdding(false);
    onOpenChange(false);
  };

  const handleAddAvulso = async () => {
    if (!avNome.trim() || !avCpf.trim()) {
      toast({ title: "Preencha Nome e CPF", variant: "destructive" });
      return;
    }
    setAdding(true);
    await onAddPerson({
      nome: avNome.trim(),
      cpf: avCpf.trim(),
      source: "AVULSO",
      email: avEmail.trim() || undefined,
      telefone: avTelefone.trim() || undefined,
    });
    setAdding(false);
    onOpenChange(false);
  };

  const showPgTab = orgSlug === "pg";
  const showContmaxTab = orgSlug === "contmax";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Pessoa</DialogTitle>
          <DialogDescription>Adicione uma pessoa para criar a declaração de IRPF.</DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            {showPgTab && <TabsTrigger value="pg">Cliente P&G</TabsTrigger>}
            {showContmaxTab && <TabsTrigger value="contmax">Cliente Contmax</TabsTrigger>}
            <TabsTrigger value="avulso">Avulso</TabsTrigger>
          </TabsList>

          {(showPgTab || showContmaxTab) && (
            <TabsContent value={showPgTab ? "pg" : "contmax"} className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar sócio por nome, CPF ou empresa..."
                    value={searchPg}
                    onChange={e => setSearchPg(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && searchSocios()}
                    className="pl-9"
                  />
                </div>
                <Button onClick={searchSocios} disabled={loadingSocios}>Buscar</Button>
              </div>

              {socios.length > 0 && (
                <div className="rounded-lg border overflow-x-auto max-h-80 overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sócio</TableHead>
                        <TableHead>CPF</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead className="w-12">%</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {socios.map((s, i) => (
                        <TableRow key={`${s.socio_cpf}-${s.empresa_id}-${i}`}>
                          <TableCell className="font-medium">{s.socio_nome}</TableCell>
                          <TableCell className="text-sm">{s.socio_cpf}</TableCell>
                          <TableCell className="text-sm">{s.empresa_nome}</TableCell>
                          <TableCell className="text-sm">{s.socio_percentual}%</TableCell>
                          <TableCell>
                            <Button size="sm" disabled={adding} onClick={() => handleAddSocio(s)}>
                              <Plus className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          )}

          <TabsContent value="avulso" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input value={avNome} onChange={e => setAvNome(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CPF *</Label>
                <Input value={avCpf} onChange={e => setAvCpf(e.target.value)} placeholder="000.000.000-00" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={avEmail} onChange={e => setAvEmail(e.target.value)} type="email" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={avTelefone} onChange={e => setAvTelefone(e.target.value)} />
              </div>
            </div>
            <Button onClick={handleAddAvulso} disabled={adding}>
              <UserPlus className="h-4 w-4 mr-2" /> Cadastrar
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
