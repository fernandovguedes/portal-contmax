import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const POLL_TIMEOUT_MS = 600_000; // 10 minutes

export interface SyncJob {
  id: string;
  status: string;
  total_processados: number;
  total_matched: number;
  total_ignored: number;
  total_review: number;
  execution_time_ms: number | null;
  error_message: string | null;
  created_at: string;
}

export interface SyncError {
  message: string;
  status?: number;
  detail?: string;
}

export interface PingResult {
  ok: boolean;
  timestamp: string;
  url: string;
}

export function useSyncAcessorias(tenantSlug: string | undefined, tenantId: string | undefined) {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<SyncJob | null>(null);
  const [error, setError] = useState<SyncError | null>(null);
  const [history, setHistory] = useState<SyncJob[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [pingResult, setPingResult] = useState<PingResult | null>(null);
  const [pinging, setPinging] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-acessorias`;

  const clearPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    if (!tenantId) return;
    setLoadingHistory(true);
    const { data } = await supabase
      .from("integration_logs")
      .select("id, status, total_processados, total_matched, total_ignored, total_review, execution_time_ms, error_message, created_at")
      .eq("tenant_id", tenantId)
      .eq("integration", "acessorias")
      .order("created_at", { ascending: false })
      .limit(10);
    setHistory((data as SyncJob[]) ?? []);
    setLoadingHistory(false);
  }, [tenantId]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => clearPolling();
  }, [clearPolling]);

  const pollJobStatus = useCallback((jobId: string) => {
    clearPolling();
    
    pollRef.current = setInterval(async () => {
      const { data } = await supabase
        .from("integration_logs")
        .select("id, status, total_processados, total_matched, total_ignored, total_review, execution_time_ms, error_message, created_at")
        .eq("tenant_id", tenantId!)
        .eq("integration", "acessorias")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setResult(data as SyncJob);
        if (data.status !== "running") {
          clearPolling();
          setSyncing(false);
          await fetchHistory();
        }
      }
    }, 3000);

    // Timeout safety: stop polling after 10 minutes
    pollTimeoutRef.current = setTimeout(() => {
      clearPolling();
      setSyncing(false);
      setError({ message: "Timeout: a sincronização não finalizou em 10 minutos. Verifique o histórico." });
      fetchHistory();
    }, POLL_TIMEOUT_MS);
  }, [fetchHistory, clearPolling, tenantId]);

  const pingSync = useCallback(async () => {
    setPinging(true);
    setPingResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("sync-acessorias", {
        method: "GET",
      });
      if (fnError) throw fnError;
      setPingResult({ ...data, url: functionUrl });
    } catch (err: any) {
      setPingResult(null);
      setError({ message: err.message ?? "Ping failed", detail: String(err) });
    } finally {
      setPinging(false);
    }
  }, [functionUrl]);

  const triggerSync = useCallback(async () => {
    if (!tenantSlug) return;
    setSyncing(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("sync-acessorias", {
        body: { tenant_slug: tenantSlug },
      });

      if (fnError) throw fnError;

      if (data?.error) {
        setError({
          message: data.error,
          detail: data.detail || undefined,
          status: data.status,
        });
        setSyncing(false);
        return;
      }

      if (data?.job_id && data?.status === "running") {
        pollJobStatus(data.job_id);
      } else {
        // Sync completed - refresh from integration_logs
        setSyncing(false);
        await fetchHistory();
        // Set result from the latest log
        const { data: latest } = await supabase
          .from("integration_logs")
          .select("id, status, total_processados, total_matched, total_ignored, total_review, execution_time_ms, error_message, created_at")
          .eq("tenant_id", tenantId!)
          .eq("integration", "acessorias")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latest) setResult(latest as SyncJob);
      }
    } catch (err: any) {
      const msg = err.message ?? "Erro ao sincronizar";
      setError({
        message: msg,
        detail: err.context?.body ? JSON.stringify(err.context.body) : undefined,
        status: err.context?.status,
      });
      setSyncing(false);
    }
  }, [tenantSlug, tenantId, fetchHistory, pollJobStatus]);

  return { syncing, result, error, history, loadingHistory, triggerSync, fetchHistory, pingSync, pingResult, pinging, functionUrl };
}
