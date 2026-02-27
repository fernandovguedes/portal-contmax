import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Award, BarChart3, Star, Trophy, ChevronDown, ChevronUp, Loader2, User } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

interface TicketScore {
  id: string;
  ticket_id: string;
  user_id: string | null;
  user_name: string | null;
  clareza: number | null;
  cordialidade: number | null;
  objetividade: number | null;
  resolucao: number | null;
  conformidade: number | null;
  score_final: number | null;
  feedback: string | null;
  scored_at: string;
  organizacao_id: string;
}

interface UnscoredTicket {
  ticket_id: string;
  user_name: string | null;
  message_count: number;
}

interface Tenant {
  id: string;
  nome: string;
  slug: string;
}

function getLastMonths(count: number) {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    months.push({ value: key, label: `${monthNames[d.getMonth()]} ${d.getFullYear()}` });
  }
  return months;
}

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-600";
}

export default function QualidadeAtendimento() {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const months = useMemo(() => getLastMonths(6), []);
  const [selectedMonth, setSelectedMonth] = useState(months[0].value);
  const [scores, setScores] = useState<TicketScore[]>([]);
  const [unscoredTickets, setUnscoredTickets] = useState<UnscoredTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);
  const [scoringTicket, setScoringTicket] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>("all");

  const userName = user?.user_metadata?.nome || user?.email?.split("@")[0] || "";

  // Fetch user's tenants
  useEffect(() => {
    if (!user) return;
    const fetchTenants = async () => {
      if (isAdmin) {
        const { data } = await supabase.from("organizacoes").select("id, nome, slug");
        setTenants((data as Tenant[]) ?? []);
      } else {
        const { data } = await supabase
          .from("user_tenants")
          .select("tenant_id, organizacoes(id, nome, slug)")
          .eq("user_id", user.id);
        const t = (data ?? []).map((d: any) => d.organizacoes).filter(Boolean);
        setTenants(t);
        if (t.length === 1) setSelectedTenant(t[0].id);
      }
    };
    fetchTenants();
  }, [user, isAdmin]);

  // Fetch scores for selected month + tenant
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const startDate = `${selectedMonth}-01T00:00:00Z`;
      const [y, m] = selectedMonth.split("-").map(Number);
      const endDate = new Date(y, m, 1).toISOString();

      // Build score query
      let scoreQuery = supabase
        .from("onecode_ticket_scores")
        .select("*")
        .gte("scored_at", startDate)
        .lt("scored_at", endDate)
        .order("score_final", { ascending: false })
        .not("score_final", "is", null);

      if (selectedTenant !== "all") {
        scoreQuery = scoreQuery.eq("organizacao_id", selectedTenant);
      }

      const { data: scoreData } = await scoreQuery;
      setScores((scoreData as TicketScore[]) ?? []);

      // Build messages query for unscored tickets
      let msgQuery = supabase
        .from("onecode_messages_raw")
        .select("ticket_id, user_name, organizacao_id")
        .gte("created_at_onecode", startDate)
        .lt("created_at_onecode", endDate);

      if (selectedTenant !== "all") {
        msgQuery = msgQuery.eq("organizacao_id", selectedTenant);
      }

      const { data: rawMessages } = await msgQuery;

      const scoredTicketIds = new Set((scoreData ?? []).map((s: any) => s.ticket_id));
      const ticketMap = new Map<string, { user_name: string | null; count: number }>();

      (rawMessages ?? []).forEach((msg: any) => {
        if (scoredTicketIds.has(msg.ticket_id)) return;
        const existing = ticketMap.get(msg.ticket_id);
        if (existing) {
          existing.count++;
        } else {
          ticketMap.set(msg.ticket_id, { user_name: msg.user_name, count: 1 });
        }
      });

      setUnscoredTickets(
        Array.from(ticketMap.entries()).map(([ticket_id, v]) => ({
          ticket_id,
          user_name: v.user_name,
          message_count: v.count,
        }))
      );

      setLoading(false);
    };
    fetchData();
  }, [selectedMonth, selectedTenant]);

  // Ranking by attendant
  const ranking = useMemo(() => {
    const map = new Map<string, { scores: TicketScore[] }>();
    scores.forEach((s) => {
      const key = s.user_name || "Desconhecido";
      if (!map.has(key)) map.set(key, { scores: [] });
      map.get(key)!.scores.push(s);
    });

    return Array.from(map.entries())
      .map(([name, { scores: sc }]) => {
        const avg = (field: keyof TicketScore) =>
          sc.reduce((sum, s) => sum + Number(s[field] ?? 0), 0) / sc.length;
        return {
          name,
          tickets: sc.length,
          avgScore: avg("score_final"),
          clareza: avg("clareza"),
          cordialidade: avg("cordialidade"),
          objetividade: avg("objetividade"),
          resolucao: avg("resolucao"),
          conformidade: avg("conformidade"),
        };
      })
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [scores]);

  // Group scores by attendant for accordion
  const scoresByAttendant = useMemo(() => {
    const map = new Map<string, TicketScore[]>();
    scores.forEach((s) => {
      const key = s.user_name || "Desconhecido";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return Array.from(map.entries())
      .map(([name, tickets]) => {
        const avg = tickets.reduce((sum, t) => sum + (t.score_final ?? 0), 0) / tickets.length;
        return { name, tickets, avgScore: avg };
      })
      .sort((a, b) => b.avgScore - a.avgScore);
  }, [scores]);

  // KPIs
  const validScores = scores.filter((s) => s.score_final != null);
  const totalTickets = validScores.length;
  const avgScore = totalTickets > 0 ? validScores.reduce((sum, t) => sum + (t.score_final ?? 0), 0) / totalTickets : 0;
  const topAttendant = ranking.length > 0 ? ranking[0].name : "—";

  const handleScore = async (ticketId: string) => {
    setScoringTicket(ticketId);
    try {
      const { data, error } = await supabase.functions.invoke("onecode-score-ticket", {
        body: { ticket_id: ticketId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Ticket avaliado com sucesso!");
      // Force re-fetch
      const startDate = `${selectedMonth}-01T00:00:00Z`;
      const [y, m] = selectedMonth.split("-").map(Number);
      const endDate = new Date(y, m, 1).toISOString();

      let scoreQuery = supabase
        .from("onecode_ticket_scores")
        .select("*")
        .gte("scored_at", startDate)
        .lt("scored_at", endDate)
        .order("score_final", { ascending: false })
        .not("score_final", "is", null);

      if (selectedTenant !== "all") {
        scoreQuery = scoreQuery.eq("organizacao_id", selectedTenant);
      }

      const { data: scoreData } = await scoreQuery;
      setScores((scoreData as TicketScore[]) ?? []);
      setUnscoredTickets((prev) => prev.filter((t) => t.ticket_id !== ticketId));
    } catch (e: any) {
      toast.error(e.message || "Erro ao avaliar ticket");
    } finally {
      setScoringTicket(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Qualidade de Atendimento"
        subtitle="Avaliação de Atendimentos OneCode"
        showBack
        backTo="/"
        userName={userName}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 animate-slide-up space-y-8">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground">Período:</span>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {tenants.length > 1 && (
            <>
              <span className="text-sm font-medium text-muted-foreground ml-4">Organização:</span>
              <Select value={selectedTenant} onValueChange={setSelectedTenant}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>

        {loading ? (
          <LoadingSkeleton variant="dashboard" />
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid gap-5 sm:grid-cols-3 stagger-children">
              <Card className="card-variant-neutral overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Tickets Avaliados</CardTitle>
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{totalTickets}</p>
                </CardContent>
              </Card>

              <Card className="card-variant-gain overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Média Geral</CardTitle>
                    <Star className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className={`text-3xl font-bold ${totalTickets > 0 ? scoreColor(avgScore) : ""}`}>
                    {totalTickets > 0 ? avgScore.toFixed(1) : "—"}
                  </p>
                </CardContent>
              </Card>

              <Card className="card-variant-gold overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Atendente Destaque</CardTitle>
                    <Trophy className="h-5 w-5 text-accent-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold truncate">{topAttendant}</p>
                </CardContent>
              </Card>
            </div>

            {/* Ranking Table */}
            {ranking.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Award className="h-5 w-5" /> Ranking por Atendente
                  </CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>Atendente</TableHead>
                        <TableHead className="text-center">Tickets</TableHead>
                        <TableHead className="text-center">Média</TableHead>
                        <TableHead className="text-center">Clareza</TableHead>
                        <TableHead className="text-center">Cordialidade</TableHead>
                        <TableHead className="text-center">Objetividade</TableHead>
                        <TableHead className="text-center">Resolução</TableHead>
                        <TableHead className="text-center">Conformidade</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ranking.map((r, i) => (
                        <TableRow key={r.name}>
                          <TableCell className="font-bold">{i + 1}</TableCell>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-center">{r.tickets}</TableCell>
                          <TableCell className={`text-center font-semibold ${scoreColor(r.avgScore)}`}>
                            {r.avgScore.toFixed(1)}
                          </TableCell>
                          <TableCell className="text-center">{r.clareza.toFixed(1)}</TableCell>
                          <TableCell className="text-center">{r.cordialidade.toFixed(1)}</TableCell>
                          <TableCell className="text-center">{r.objetividade.toFixed(1)}</TableCell>
                          <TableCell className="text-center">{r.resolucao.toFixed(1)}</TableCell>
                          <TableCell className="text-center">{r.conformidade.toFixed(1)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Scored Tickets grouped by attendant */}
            {scoresByAttendant.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tickets Avaliados</CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="w-full">
                    {scoresByAttendant.map((group) => (
                      <AccordionItem key={group.name} value={group.name}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3 text-left">
                            <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                            <span className="font-medium">{group.name}</span>
                            <span className="text-xs text-muted-foreground">
                              ({group.tickets.length} {group.tickets.length === 1 ? "ticket" : "tickets"})
                            </span>
                            <span className={`text-sm font-semibold ${scoreColor(group.avgScore)}`}>
                              Média: {group.avgScore.toFixed(1)}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Ticket</TableHead>
                                  <TableHead className="text-center">Score</TableHead>
                                  <TableHead>Data</TableHead>
                                  <TableHead className="w-12"></TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {group.tickets.map((s) => (
                                  <>
                                    <TableRow key={s.id} className="cursor-pointer" onClick={() => setExpandedTicket(expandedTicket === s.id ? null : s.id)}>
                                      <TableCell className="font-mono text-xs">{s.ticket_id}</TableCell>
                                      <TableCell className={`text-center font-semibold ${s.score_final != null ? scoreColor(s.score_final) : ""}`}>
                                        {s.score_final != null ? s.score_final.toFixed(1) : "—"}
                                      </TableCell>
                                      <TableCell className="text-sm text-muted-foreground">
                                        {new Date(s.scored_at).toLocaleDateString("pt-BR")}
                                      </TableCell>
                                      <TableCell>
                                        {expandedTicket === s.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                      </TableCell>
                                    </TableRow>
                                    {expandedTicket === s.id && (
                                      <TableRow key={`${s.id}-feedback`}>
                                        <TableCell colSpan={4} className="bg-muted/30">
                                          <div className="space-y-2 py-2">
                                            <div className="flex gap-4 text-xs text-muted-foreground">
                                              <span>Clareza: {s.clareza}</span>
                                              <span>Cordialidade: {s.cordialidade}</span>
                                              <span>Objetividade: {s.objetividade}</span>
                                              <span>Resolução: {s.resolucao}</span>
                                              <span>Conformidade: {s.conformidade}</span>
                                            </div>
                                            <p className="text-sm">{s.feedback || "Sem feedback"}</p>
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )}
            {unscoredTickets.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Tickets Pendentes de Avaliação</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Atendente</TableHead>
                        <TableHead className="text-center">Mensagens</TableHead>
                        <TableHead className="text-right">Ação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {unscoredTickets.map((t) => (
                        <TableRow key={t.ticket_id}>
                          <TableCell className="font-mono text-xs">{t.ticket_id}</TableCell>
                          <TableCell>{t.user_name || "—"}</TableCell>
                          <TableCell className="text-center">{t.message_count}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              onClick={() => handleScore(t.ticket_id)}
                              disabled={scoringTicket === t.ticket_id}
                            >
                              {scoringTicket === t.ticket_id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                              ) : (
                                <Star className="h-4 w-4 mr-1" />
                              )}
                              Avaliar
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}


            {scores.length === 0 && unscoredTickets.length === 0 && (
              <div className="text-center py-20">
                <Award className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
                <h2 className="text-xl font-semibold text-muted-foreground">Nenhum dado disponível</h2>
                <p className="text-sm text-muted-foreground mt-2">Não há tickets ou avaliações para este período.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
