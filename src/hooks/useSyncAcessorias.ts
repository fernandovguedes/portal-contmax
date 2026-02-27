import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const POLL_TIMEOUT_MS = 600_000; // 10 minutes

export interface SyncJob {
  id: string;
  status: string;
  total_read: number;
  total_created: number;
  total_updated: number;
  total_skipped: number;
  total_errors: number;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
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
      .from("sync_jobs")
      .select("id, status, total_read, total_created, total_updated, total_skipped, total_errors, error_message, started_at, finished_at")
      .eq("tenant_id", tenantId)
      .order("started_at", { ascending: false })
      .limit(1);
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
        .from("sync_jobs")
        .select("id, status, total_read, total_created, total_updated, total_skipped, total_errors, error_message, started_at, finished_at")
        .eq("id", jobId)
        .single();

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
  }, [fetchHistory, clearPolling]);

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
        // Backend still processing (shouldn't happen with sync mode, but keep as fallback)
        setResult({ ...(data as any), total_read: 0, total_created: 0, total_updated: 0, total_skipped: 0, total_errors: 0, started_at: new Date().toISOString(), finished_at: null, error_message: null } as SyncJob);
        pollJobStatus(data.job_id);
      } else {
        // Sync completed - backend returned final result
        setResult({
          id: data.job_id,
          status: data.status ?? "success",
          total_read: data.total_read ?? 0,
          total_created: data.total_created ?? 0,
          total_updated: data.total_updated ?? 0,
          total_skipped: data.total_skipped ?? 0,
          total_errors: data.total_errors ?? 0,
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          error_message: null,
        } as SyncJob);
        setSyncing(false);
        await fetchHistory();
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
  }, [tenantSlug, fetchHistory, pollJobStatus]);

  return { syncing, result, error, history, loadingHistory, triggerSync, fetchHistory, pingSync, pingResult, pinging, functionUrl };
}
