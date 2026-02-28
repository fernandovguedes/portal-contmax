import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "@/hooks/use-toast";

export interface Module {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  icone: string | null;
  ativo: boolean;
  ordem: number;
  organizacao_id: string | null;
}

export function useModules() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setModules([]);
      setLoading(false);
      return;
    }

    const fetchModules = async () => {
      if (isAdmin) {
        // Admins see all active modules
        const { data, error } = await supabase
          .from("modules")
          .select("*")
          .eq("ativo", true)
          .order("ordem");
        if (error) {
          toast({ title: "Erro ao carregar módulos", description: error.message, variant: "destructive" });
          setLoading(false);
          return;
        }
        setModules((data as Module[]) ?? []);
      } else {
        // Regular users see only their assigned modules
        const { data, error } = await supabase
          .from("user_modules")
          .select("module_id, modules(id, nome, slug, descricao, icone, ativo, ordem)")
          .eq("user_id", user.id);

        if (error) {
          toast({ title: "Erro ao carregar módulos", description: error.message, variant: "destructive" });
          setLoading(false);
          return;
        }
        const mods = (data ?? [])
          .map((d: any) => d.modules)
          .filter((m: any) => m && m.ativo)
          .sort((a: Module, b: Module) => a.ordem - b.ordem);
        setModules(mods);
      }
      setLoading(false);
    };

    fetchModules();
  }, [user, isAdmin]);

  return { modules, loading };
}
