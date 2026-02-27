import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentValue: number;
  onSave: (value: number) => Promise<void>;
}

export function SalarioMinimoDialog({ open, onOpenChange, currentValue, onSave }: Props) {
  const [value, setValue] = useState(currentValue.toString());
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const num = parseFloat(value.replace(",", "."));
    if (isNaN(num) || num <= 0) return;
    setSaving(true);
    await onSave(num);
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Salário Mínimo Vigente</DialogTitle>
          <DialogDescription>Altere o valor do salário mínimo usado nos cálculos.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Valor (R$)</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="1618.00"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
