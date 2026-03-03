import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import type { IrpfDependente } from "@/types/irpf";

interface Props {
  dependentes: IrpfDependente[];
  onChange: (deps: IrpfDependente[]) => void;
  disabled?: boolean;
}

export function IrpfDependentesEditor({ dependentes, onChange, disabled }: Props) {
  const add = () => {
    onChange([...dependentes, { nome: "", cpf: "", nascimento: "", parentesco: "" }]);
  };

  const remove = (idx: number) => {
    onChange(dependentes.filter((_, i) => i !== idx));
  };

  const update = (idx: number, field: keyof IrpfDependente, value: string) => {
    onChange(dependentes.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Dependentes</h4>
        {!disabled && (
          <Button variant="outline" size="sm" onClick={add}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar dependente
          </Button>
        )}
      </div>

      {dependentes.length > 0 && (
        <div className="rounded-lg border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Nascimento</TableHead>
                <TableHead>Parentesco</TableHead>
                {!disabled && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dependentes.map((d, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Input value={d.nome} onChange={e => update(i, "nome", e.target.value)} disabled={disabled} className="h-8 text-xs" />
                  </TableCell>
                  <TableCell>
                    <Input value={d.cpf} onChange={e => update(i, "cpf", e.target.value)} disabled={disabled} className="h-8 text-xs" />
                  </TableCell>
                  <TableCell>
                    <Input value={d.nascimento} onChange={e => update(i, "nascimento", e.target.value)} disabled={disabled} className="h-8 text-xs" placeholder="dd/mm/aaaa" />
                  </TableCell>
                  <TableCell>
                    <Input value={d.parentesco} onChange={e => update(i, "parentesco", e.target.value)} disabled={disabled} className="h-8 text-xs" />
                  </TableCell>
                  {!disabled && (
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => remove(i)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {dependentes.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum dependente adicionado.</p>
      )}
    </div>
  );
}
