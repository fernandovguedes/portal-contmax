import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCallback } from "react";

export interface WhatsAppLogInfo {
  sentAt: string;
  sentBy: string;
}

export function useWhatsAppLogs(competencia: string) {
  const queryClient = useQueryClient();

  const { data: logsMap = new Map<string, WhatsAppLogInfo>() } = useQuery({
    queryKey: ["whatsapp-logs", competencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_logs")
        .select("empresa_id, created_at, user_id")
        .eq("competencia", competencia)
        .eq("message_type", "extrato_nao_enviado")
        .eq("status", "success")
        .order("created_at", { ascending: false });

      if (error || !data) return new Map<string, WhatsAppLogInfo>();

      // Collect unique user_ids
      const userIds = [...new Set(data.map((r) => r.user_id))];
      
      // Fetch profile names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome")
        .in("id", userIds);

      const profileMap = new Map<string, string>();
      profiles?.forEach((p) => profileMap.set(p.id, p.nome || "Usuário"));

      // Group by empresa_id (first = most recent due to order)
      const map = new Map<string, WhatsAppLogInfo>();
      for (const row of data) {
        if (!map.has(row.empresa_id)) {
          map.set(row.empresa_id, {
            sentAt: row.created_at,
            sentBy: profileMap.get(row.user_id) || "Usuário",
          });
        }
      }
      return map;
    },
    staleTime: 30_000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["whatsapp-logs", competencia] });
  }, [queryClient, competencia]);

  return { logsMap, invalidate };
}
