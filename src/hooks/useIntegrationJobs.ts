import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface IntegrationJob {
  id: string;
  tenant_id: string;
  provider_slug: string;
  status: string;
  progress: number;
  attempts: number;
  max_attempts: number;
  started_at: string | null;
  finished_at: string | null;
  execution_time_ms: number | null;
  error_message: string | null;
  payload: Record<string, any>;
  result: any;
  created_by: string | null;
  created_at: string;
}

export function useIntegrationJobs(tenantIds?: string[]) {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<IntegrationJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("integration_jobs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setJobs((data ?? []) as IntegrationJob[]);
    } catch (err) {
      console.error("useIntegrationJobs fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("integration-jobs-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "integration_jobs",
        },
        (payload) => {
          const newRecord = payload.new as IntegrationJob;
          const eventType = payload.eventType;

          setJobs((prev) => {
            if (eventType === "INSERT") {
              return [newRecord, ...prev];
            }
            if (eventType === "UPDATE") {
              return prev.map((j) => (j.id === newRecord.id ? newRecord : j));
            }
            if (eventType === "DELETE") {
              const oldRecord = payload.old as { id: string };
              return prev.filter((j) => j.id !== oldRecord.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getActiveJob = useCallback(
    (tenantId: string, providerSlug: string) => {
      const STALE_MS = 15 * 60 * 1000; // 15 minutes
      const now = Date.now();
      return jobs.find((j) => {
        if (j.tenant_id !== tenantId || j.provider_slug !== providerSlug) return false;
        if (j.status !== "pending" && j.status !== "running") return false;
        // Ignore stale jobs to prevent UI deadlock
        const refDate = j.started_at ?? j.created_at;
        const age = now - new Date(refDate).getTime();
        return age < STALE_MS;
      });
    },
    [jobs]
  );

  const getLatestJob = useCallback(
    (tenantId: string, providerSlug: string) => {
      return jobs.find(
        (j) => j.tenant_id === tenantId && j.provider_slug === providerSlug
      );
    },
    [jobs]
  );

  const getJobsByProvider = useCallback(
    (tenantId: string, providerSlug: string) => {
      return jobs.filter(
        (j) => j.tenant_id === tenantId && j.provider_slug === providerSlug
      );
    },
    [jobs]
  );

  const submitJob = async (tenantId: string, providerSlug: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("run-integration", {
        body: { tenant_id: tenantId, provider_slug: providerSlug },
      });

      // supabase.functions.invoke wraps non-2xx in error, but data may still have info
      if (error) {
        // 409 case: job already running — data may contain job_id
        if (data?.job_id) {
          toast({
            title: "Execução em andamento",
            description: "Já existe uma execução em andamento para esta integração.",
          });
          return data;
        }
        throw error;
      }

      toast({ title: "Job criado", description: `Integração ${providerSlug} adicionada à fila.` });

      // Short delay refetch as fallback if realtime is slow
      setTimeout(() => fetchJobs(), 2000);

      return data;
    } catch (err: any) {
      const msg = err?.message || err?.context?.message || "Erro desconhecido";
      toast({ title: "Erro ao criar job", description: msg, variant: "destructive" });
    }
  };

  return {
    jobs,
    loading,
    getActiveJob,
    getLatestJob,
    getJobsByProvider,
    submitJob,
    refetch: fetchJobs,
  };
}
