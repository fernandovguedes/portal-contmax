import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import type { IrpfDocument } from "@/types/irpf";

function rowToDoc(r: any): IrpfDocument {
  return {
    id: r.id,
    irpfCaseId: r.irpf_case_id,
    tenantId: r.tenant_id,
    docType: r.doc_type,
    path: r.path,
    originalName: r.original_name ?? undefined,
    mimeType: r.mime_type ?? undefined,
    sizeBytes: r.size_bytes ? Number(r.size_bytes) : undefined,
    createdAt: r.created_at,
    notes: r.notes ?? undefined,
  };
}

export function useIrpfDocuments(caseId: string | undefined, tenantId: string | undefined) {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<IrpfDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocs = useCallback(async () => {
    if (!caseId || !tenantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("irpf_documents")
      .select("*")
      .eq("irpf_case_id", caseId)
      .order("doc_type")
      .order("created_at", { ascending: false });

    if (error) {
      toast({ title: "Erro ao carregar documentos", description: error.message, variant: "destructive" });
    } else {
      setDocuments((data || []).map(rowToDoc));
    }
    setLoading(false);
  }, [caseId, tenantId]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const uploadDocument = useCallback(async (docType: string, file: File) => {
    if (!caseId || !tenantId || !user) return false;
    const ext = file.name.split(".").pop() || "bin";
    const uuid = crypto.randomUUID();
    const path = `tenant/${tenantId}/case/${caseId}/${docType}/${uuid}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("irpf-docs")
      .upload(path, file);

    if (uploadError) {
      toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
      return false;
    }

    const { error: insertError } = await supabase
      .from("irpf_documents")
      .insert({
        irpf_case_id: caseId,
        tenant_id: tenantId,
        doc_type: docType,
        path,
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: user.id,
      });

    if (insertError) {
      toast({ title: "Erro ao salvar metadados", description: insertError.message, variant: "destructive" });
      return false;
    }

    toast({ title: "Documento enviado com sucesso" });
    await fetchDocs();
    return true;
  }, [caseId, tenantId, user, fetchDocs]);

  const deleteDocument = useCallback(async (doc: IrpfDocument) => {
    await supabase.storage.from("irpf-docs").remove([doc.path]);
    const { error } = await supabase.from("irpf_documents").delete().eq("id", doc.id);
    if (error) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Documento excluído" });
    await fetchDocs();
    return true;
  }, [fetchDocs]);

  const getSignedUrl = useCallback(async (path: string) => {
    const { data, error } = await supabase.storage
      .from("irpf-docs")
      .createSignedUrl(path, 300);
    if (error) {
      toast({ title: "Erro ao gerar link", description: error.message, variant: "destructive" });
      return null;
    }
    return data.signedUrl;
  }, []);

  return { documents, loading, uploadDocument, deleteDocument, getSignedUrl, refetch: fetchDocs };
}
