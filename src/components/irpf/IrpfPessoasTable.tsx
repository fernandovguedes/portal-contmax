import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import type { IrpfPerson, IrpfCase } from "@/types/irpf";

function origemBadge(source: string, orgSlug: string) {
  if (source === "AVULSO") return { label: "Avulso", className: "", variant: "secondary" as const };
  if (orgSlug === "contmax") return { label: "Contmax", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", variant: undefined };
  return { label: "P&G", className: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300", variant: undefined };
}

interface Props {
  people: IrpfPerson[];
  cases: IrpfCase[];
  anoBase: number;
  canEdit: boolean;
  orgSlug: string;
  onCreateCase: (personId: string) => void;
}

export function IrpfPessoasTable({ people, cases, anoBase, canEdit, orgSlug, onCreateCase }: Props) {
  const casePersonIds = new Set(cases.map(c => c.irpfPersonId));

  return (
    <div className="rounded-xl border bg-card overflow-x-auto shadow-sm table-zebra">
      <Table>
        <TableHeader>
          <TableRow className="header-gradient text-primary-foreground hover:bg-transparent [&>th]:text-primary-foreground/90 [&>th]:font-semibold">
            <TableHead>Nome</TableHead>
            <TableHead>CPF</TableHead>
            <TableHead className="w-20">Origem</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Contato</TableHead>
            <TableHead className="w-24">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {people.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                Nenhuma pessoa cadastrada.
              </TableCell>
            </TableRow>
          )}
          {people.map(p => {
            const hasCase = casePersonIds.has(p.id);
            return (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.nome}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{p.cpf}</TableCell>
                <TableCell>
                  {(() => { const ob = origemBadge(p.source, orgSlug); return (
                    <Badge variant={ob.variant || "default"} className={`text-[10px] ${ob.className}`}>{ob.label}</Badge>
                  ); })()}
                </TableCell>
                <TableCell className="text-sm">{p.empresaNome || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {p.email || p.telefone || "—"}
                </TableCell>
                <TableCell>
                  {canEdit && !hasCase && (
                    <Button variant="outline" size="sm" onClick={() => onCreateCase(p.id)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> {anoBase}
                    </Button>
                  )}
                  {hasCase && (
                    <Badge variant="outline" className="text-[10px]">Já tem {anoBase}</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
