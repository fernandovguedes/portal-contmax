import { useCallback, useState } from "react";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parseComparativoExcel } from "@/lib/parseComparativoExcel";
import type { ComparativoData } from "@/types/comparativo";

interface UploadAreaProps {
  onDataParsed: (data: ComparativoData) => void;
}

export function UploadArea({ onDataParsed }: UploadAreaProps) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setLoading(true);
    try {
      const data = await parseComparativoExcel(file);
      onDataParsed(data);
    } catch (err: any) {
      setError(err.message || "Erro ao processar arquivo");
    } finally {
      setLoading(false);
    }
  }, [onDataParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <Card
        className={`w-full max-w-lg p-10 border-2 border-dashed transition-colors cursor-pointer ${
          dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("excel-upload")?.click()}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="rounded-2xl bg-primary/10 p-4">
            {loading ? (
              <FileSpreadsheet className="h-10 w-10 text-primary animate-pulse" />
            ) : (
              <Upload className="h-10 w-10 text-primary" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold">
              {loading ? "Processando..." : "Envie o arquivo Excel"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Arraste e solte ou clique para selecionar o arquivo .xlsx com os dados do comparativo tributário
            </p>
          </div>
          <Button variant="outline" size="sm" disabled={loading}>
            Selecionar arquivo
          </Button>
          <input
            id="excel-upload"
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileInput}
          />
        </div>
      </Card>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
    </div>
  );
}
