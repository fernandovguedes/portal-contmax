import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

export function useModulePermissions(moduleSlug: string = "controle-fiscal") {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setCanEdit(false);
      setLoading(false);
      return;
    }

    if (roleLoading) return;

    if (isAdmin) {
      setCanEdit(true);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from("user_modules")
        .select("can_edit, modules!inner(slug)")
        .eq("user_id", user.id)
        .eq("modules.slug", moduleSlug)
        .maybeSingle();

      setCanEdit(!!(data as any)?.can_edit);
      setLoading(false);
    };

    fetch();
  }, [user, isAdmin, roleLoading, moduleSlug]);

  return { canEdit, loading };
}
