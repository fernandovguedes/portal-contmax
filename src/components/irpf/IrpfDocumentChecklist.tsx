import { useRef, useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CheckCircle, Circle, Paperclip, Eye, Trash2 } from "lucide-react";
import { DOC_TYPES, type IrpfDocument } from "@/types/irpf";
import { format } from "date-fns";

interface Props {
  documents: IrpfDocument[];
  canEdit: boolean;
  onUpload: (docType: string, file: File) => Promise<boolean>;
  onDelete: (doc: IrpfDocument) => Promise<boolean>;
  onView: (path: string) => Promise<string | null>;
}

function formatSize(bytes?: number) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function IrpfDocumentChecklist({ documents, canEdit, onUpload, onDelete, onView }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IrpfDocument | null>(null);

  const docsByType: Record<string, IrpfDocument[]> = {};
  documents.forEach(d => {
    if (!docsByType[d.docType]) docsByType[d.docType] = [];
    docsByType[d.docType].push(d);
  });

  const handleFileSelect = (docType: string) => {
    setUploadingType(docType);
    fileRef.current?.click();
  };

  const handleFilesChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !uploadingType) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 20 * 1024 * 1024) {
        continue; // skip files > 20MB
      }
      await onUpload(uploadingType, file);
    }
    setUploadingType(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleView = async (path: string) => {
    const url = await onView(path);
    if (url) window.open(url, "_blank");
  };

  const handleConfirmDelete = async () => {
    if (deleteTarget) {
      await onDelete(deleteTarget);
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <input
        type="file"
        ref={fileRef}
        className="hidden"
        multiple
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFilesChosen}
      />

      <Accordion type="multiple" className="space-y-2">
        {DOC_TYPES.map(dt => {
          const docs = docsByType[dt.key] || [];
          const hasDoc = docs.length > 0;

          return (
            <AccordionItem key={dt.key} value={dt.key} className="rounded-lg border bg-card px-4">
              <AccordionTrigger className="hover:no-underline py-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {hasDoc ? (
                    <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                  )}
                  <span className="text-sm font-medium text-left truncate">{dt.label}</span>
                  {docs.length > 0 && (
                    <Badge variant="secondary" className="text-[10px] ml-auto mr-2 shrink-0">
                      {docs.length} {docs.length === 1 ? "arquivo" : "arquivos"}
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>

              <AccordionContent className="pb-4">
                {canEdit && (
                  <Button variant="outline" size="sm" className="mb-3" onClick={() => handleFileSelect(dt.key)}>
                    <Paperclip className="h-3.5 w-3.5 mr-1" /> Enviar arquivo
                  </Button>
                )}

                {docs.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum arquivo enviado.</p>
                )}

                {docs.length > 0 && (
                  <div className="space-y-2">
                    {docs.map(d => (
                      <div key={d.id} className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm">
                        <span className="flex-1 truncate">{d.originalName || "arquivo"}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{formatSize(d.sizeBytes)}</span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {format(new Date(d.createdAt), "dd/MM/yyyy")}
                        </span>
                        <Button variant="ghost" size="sm" onClick={() => handleView(d.path)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {canEdit && (
                          <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(d)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo "{deleteTarget?.originalName}" será excluído permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
