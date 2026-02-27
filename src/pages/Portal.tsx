import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useModules, Module } from "@/hooks/useModules";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings, FileText, LayoutDashboard, Users, DollarSign, BarChart3, Award, Cable } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";

const ICON_MAP: Record<string, typeof FileText> = {
  FileText,
  LayoutDashboard,
  Users,
  DollarSign,
  BarChart3,
  Award,
  Settings,
};

function getModuleIcon(iconName: string | null) {
  return ICON_MAP[iconName ?? ""] ?? LayoutDashboard;
}

const MODULE_ROUTES: Record<string, string> = {
  "controle-fiscal": "/controle-fiscal",
  "clientes-pg": "/clientes/pg",
  "clientes-contmax": "/clientes/contmax",
  "honorarios-contmax": "/honorarios-contmax",
  "comparativo-tributario": "/comparativo-tributario",
  "dashboard-executivo": "/dashboard-executivo",
  "qualidade-atendimento": "/qualidade-atendimento",
  "integracoes": "/integracoes",
};

export default function Portal() {
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();
  const { modules, loading } = useModules();
  const navigate = useNavigate();

  if (loading) {
    return <LoadingSkeleton variant="portal" />;
  }

  const userName = user?.user_metadata?.nome || user?.email?.split("@")[0] || "";

  const systemModules = modules.filter((m: Module) => !m.slug.startsWith("clientes-") && m.slug !== "integracoes");
  const clientModules = modules.filter((m: Module) => m.slug.startsWith("clientes-"));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Portal Contmax"
        subtitle="Selecione um módulo para começar"
        showLogout
        userName={userName}
        actions={
          isAdmin ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/integracoes")}
                className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
              >
                <Cable className="mr-1 h-4 w-4" /> Integrações
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin")}
                className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
              >
                <Settings className="mr-1 h-4 w-4" /> Admin
              </Button>
            </>
          ) : undefined
        }
      />

      <main className="mx-auto max-w-5xl px-4 py-10 animate-slide-up">
        {modules.length === 0 ? (
          <div className="text-center py-20">
            <LayoutDashboard className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold text-muted-foreground">Nenhum módulo disponível</h2>
            <p className="text-sm text-muted-foreground mt-2">Contate o administrador para obter acesso aos módulos.</p>
          </div>
        ) : (
          <>
            {/* Módulos do Sistema */}
            {systemModules.length > 0 && (
              <section className="mb-10">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Módulos do Sistema</h2>
                <div className="grid gap-5 sm:grid-cols-2 stagger-children">
                  {systemModules.map((mod) => {
                    const Icon = getModuleIcon(mod.icone);
                    const route = MODULE_ROUTES[mod.slug] ?? "#";
                    return (
                      <Card
                        key={mod.id}
                        className="cursor-pointer card-hover accent-bar-left overflow-hidden border-border/60"
                        onClick={() => navigate(route)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-center gap-4">
                            <div className="rounded-xl bg-gradient-to-br from-primary to-primary/70 p-3 text-primary-foreground shadow-md">
                              <Icon className="h-7 w-7" />
                            </div>
                            <CardTitle className="text-lg">{mod.nome}</CardTitle>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <CardDescription className="text-sm">{mod.descricao ?? "Sem descrição"}</CardDescription>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Base de Clientes */}
            {clientModules.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Base de Clientes</h2>
                <div className="flex flex-col gap-3 stagger-children">
                  {clientModules.map((mod) => {
                    const Icon = getModuleIcon(mod.icone);
                    const route = MODULE_ROUTES[mod.slug] ?? "#";
                    return (
                      <Card
                        key={mod.id}
                        className="cursor-pointer card-hover accent-bar-left overflow-hidden border-border/60"
                        onClick={() => navigate(route)}
                      >
                        <div className="flex items-center gap-3 px-4 py-3">
                          <div className="rounded-lg bg-gradient-to-br from-primary to-primary/70 p-2 text-primary-foreground shadow-sm">
                            <Icon className="h-4 w-4" />
                          </div>
                          <span className="font-medium text-sm">{mod.nome}</span>
                          <span className="text-xs text-muted-foreground ml-auto hidden sm:block">{mod.descricao ?? ""}</span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
