import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
import type { ServicosExtrasItem } from "@/hooks/useHonorarios";

function formatCurrency(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface LocalItem {
  descricao: string;
  valor: string;
}

interface Props {
  items: ServicosExtrasItem[];
  totalValue: number;
  canEdit: boolean;
  onSave: (items: ServicosExtrasItem[]) => void;
}

export function ServicosExtrasPopover({ items, totalValue, canEdit, onSave }: Props) {
  const [open, setOpen] = useState(false);
  const [localItems, setLocalItems] = useState<LocalItem[]>([]);

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setLocalItems(
        items.length > 0
          ? items.map((i) => ({
              descricao: i.descricao,
              valor: i.valor ? String(i.valor).replace(".", ",") : "",
            }))
          : [{ descricao: "", valor: "" }]
      );
    }
    setOpen(isOpen);
  };

  const addItem = () => {
    setLocalItems([...localItems, { descricao: "", valor: "" }]);
  };

  const removeItem = (index: number) => {
    setLocalItems(localItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof LocalItem, value: string) => {
    const updated = [...localItems];
    updated[index] = { ...updated[index], [field]: value };
    setLocalItems(updated);
  };

  const parseValor = (str: string) => parseFloat(str.replace(",", ".")) || 0;

  const handleSave = () => {
    const filtered = localItems
      .map((i) => ({ descricao: i.descricao.trim(), valor: parseValor(i.valor) }))
      .filter((i) => i.descricao || i.valor > 0);
    onSave(filtered);
    setOpen(false);
  };

  const total = localItems.reduce((sum, i) => sum + parseValor(i.valor), 0);

  if (!canEdit) {
    if (totalValue === 0) return <span className="text-xs">—</span>;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <span className="text-xs cursor-pointer hover:bg-muted px-1 py-0.5 rounded">
            {formatCurrency(totalValue)}
          </span>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="center">
          <p className="text-xs font-semibold mb-2">Detalhes dos Serviços Extras</p>
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem detalhes.</p>
          ) : (
            <div className="space-y-1">
              {items.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="truncate mr-2">{item.descricao || "—"}</span>
                  <span className="font-medium whitespace-nowrap">{formatCurrency(item.valor)}</span>
                </div>
              ))}
              <div className="border-t pt-1 flex justify-between text-xs font-bold">
                <span>Total</span>
                <span>{formatCurrency(totalValue)}</span>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <span className="text-xs cursor-pointer hover:bg-muted px-1 py-0.5 rounded">
          {totalValue > 0 ? formatCurrency(totalValue) : "—"}
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="center">
        <p className="text-xs font-semibold mb-2">Serviços Extras</p>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {localItems.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <Input
                placeholder="Descrição"
                className="h-7 text-xs flex-1"
                value={item.descricao}
                onChange={(e) => updateItem(i, "descricao", e.target.value)}
              />
              <Input
                placeholder="Valor"
                className="h-7 text-xs w-20"
                value={item.valor}
                onChange={(e) => updateItem(i, "valor", e.target.value)}
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive shrink-0"
                onClick={() => removeItem(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2 pt-2 border-t">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addItem}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
          <span className="text-xs font-bold">{formatCurrency(total)}</span>
        </div>
        <Button size="sm" className="w-full mt-2 h-7 text-xs" onClick={handleSave}>
          Salvar
        </Button>
      </PopoverContent>
    </Popover>
  );
}
