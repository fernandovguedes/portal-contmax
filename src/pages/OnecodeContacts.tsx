import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList,
  BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { toast } from "@/hooks/use-toast";
import { RefreshCw, CheckCircle, XCircle, Users, AlertTriangle, Clock, ArrowLeft } from "lucide-react";

export default function OnecodeContacts() {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  const [syncing, setSyncing] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    total_processados: 0,
    total_matched: 0,
    total_review: 0,
    total_ignored: 0,
  });
  const [tenantId, setTenantId] = useState<string | null>(null);

  // Get user's tenant
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_tenants")
      .select("tenant_id")
      .eq("user_id", user.id)
      .limit(1)
      .then(({ data }) => {
        if (data?.[0]) setTenantId(data[0].tenant_id);
      });
  }, [user]);

  // Load data
  useEffect(() => {
    if (!tenantId) return;
    loadData();
  }, [tenantId]);

  async function loadData() {
    if (!tenantId) return;

    // Reviews pendentes
    const { data: revData } = await supabase
      .from("onecode_contact_review")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("resolved", false)
      .order("similarity_score", { ascending: false });
    setReviews(revData || []);

    // Integration logs
    const { data: logData } = await supabase
      .from("integration_logs")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("integration", "onecode-contacts")
      .order("created_at", { ascending: false })
      .limit(10);
    setLogs(logData || []);

    // Metrics from latest log
    if (logData?.[0]) {
      setMetrics({
        total_processados: logData[0].total_processados,
        total_matched: logData[0].total_matched,
        total_review: logData[0].total_review,
        total_ignored: logData[0].total_ignored,
      });
    }
  }

  async function handleSync() {
    if (!tenantId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-onecode-contacts", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      toast({
        title: "Sincronização concluída",
        description: `${data.total_matched} matches, ${data.total_review} para revisão, ${data.total_ignored} ignorados`,
      });
      await loadData();
    } catch (err: any) {
      toast({
        title: "Erro na sincronização",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleApprove(review: any) {
    // Update empresa
    const { error: updErr } = await supabase
      .from("empresas")
      .update({
        whatsapp: review.contact_phone,
        onecode_contact_id: review.contact_id,
        whatsapp_synced_at: new Date().toISOString(),
      })
      .eq("id", review.suggested_company_id);

    if (updErr) {
      toast({ title: "Erro ao aprovar", description: updErr.message, variant: "destructive" });
      return;
    }

    // Mark resolved
    await supabase
      .from("onecode_contact_review")
      .update({
        resolved: true,
        resolved_action: "approved",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", review.id);

    toast({ title: "Aprovado", description: `WhatsApp vinculado a ${review.suggested_company_name}` });
    setReviews((prev) => prev.filter((r) => r.id !== review.id));
  }

  async function handleIgnore(review: any) {
    await supabase
      .from("onecode_contact_review")
      .update({
        resolved: true,
        resolved_action: "ignored",
        resolved_at: new Date().toISOString(),
      })
      .eq("id", review.id);

    toast({ title: "Ignorado" });
    setReviews((prev) => prev.filter((r) => r.id !== review.id));
  }

  if (roleLoading) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  if (!isAdmin) {
    navigate("/");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/">Portal</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/admin">Admin</BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>OneCode Contacts</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <h1 className="text-2xl font-bold text-foreground">Integração OneCode</h1>
            <p className="text-muted-foreground text-sm">
              Sincronize contatos do WhatsApp com as empresas cadastradas
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <Button onClick={handleSync} disabled={syncing || !tenantId} size="sm">
              <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Sincronizando..." : "Sincronizar Contatos"}
            </Button>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Processados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-2xl font-bold">{metrics.total_processados}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Matches Automáticos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-2xl font-bold">{metrics.total_matched}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pendentes Revisão
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="text-2xl font-bold">{metrics.total_review}</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Ignorados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-muted-foreground" />
                <span className="text-2xl font-bold">{metrics.total_ignored}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Review Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Revisão de Matches</CardTitle>
          </CardHeader>
          <CardContent>
            {reviews.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhum match pendente de revisão.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contato OneCode</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Empresa Sugerida</TableHead>
                      <TableHead>Similaridade</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reviews.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.contact_name}</TableCell>
                        <TableCell>{r.contact_phone || "—"}</TableCell>
                        <TableCell>{r.suggested_company_name}</TableCell>
                        <TableCell>
                          <Badge variant={r.similarity_score >= 0.8 ? "default" : "secondary"}>
                            {(r.similarity_score * 100).toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button size="sm" variant="default" onClick={() => handleApprove(r)}>
                            <CheckCircle className="h-3 w-3 mr-1" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleIgnore(r)}>
                            <XCircle className="h-3 w-3 mr-1" /> Ignorar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Execution History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Execuções</CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Nenhuma execução registrada.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Processados</TableHead>
                      <TableHead>Matched</TableHead>
                      <TableHead>Revisão</TableHead>
                      <TableHead>Ignorados</TableHead>
                      <TableHead>Tempo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            {new Date(l.created_at).toLocaleString("pt-BR")}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={l.status === "success" ? "default" : "destructive"}>
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{l.total_processados}</TableCell>
                        <TableCell>{l.total_matched}</TableCell>
                        <TableCell>{l.total_review}</TableCell>
                        <TableCell>{l.total_ignored}</TableCell>
                        <TableCell>{l.execution_time_ms ? `${l.execution_time_ms}ms` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
