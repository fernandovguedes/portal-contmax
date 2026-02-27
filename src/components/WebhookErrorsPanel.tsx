import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

interface WebhookEvent {
  id: string;
  received_at: string;
  source: string | null;
  onecode_object: string | null;
  onecode_action: string | null;
  message_id: string | null;
  ticket_id: number | null;
  error_message: string | null;
  processed: boolean;
  payload_json: any;
}

export function WebhookErrorsPanel() {
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("onecode_webhook_events" as any)
      .select("*")
      .eq("processed", false)
      .not("error_message", "is", null)
      .order("received_at", { ascending: false })
      .limit(50);
    setEvents((data as unknown as WebhookEvent[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  if (!loading && events.length === 0) return null;

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Webhook Errors ({events.length})
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={fetchEvents} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="text-xs">
              <TableHead>Data</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Ticket</TableHead>
              <TableHead>Erro</TableHead>
              <TableHead className="w-8"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((ev) => (
              <>
                <TableRow key={ev.id} className="text-xs cursor-pointer" onClick={() => setExpanded(expanded === ev.id ? null : ev.id)}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(ev.received_at), "dd/MM HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">{ev.source ?? "?"}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[10px]">
                    {ev.onecode_object}.{ev.onecode_action}
                  </TableCell>
                  <TableCell>{ev.ticket_id ?? "—"}</TableCell>
                  <TableCell className="text-destructive max-w-[200px] truncate" title={ev.error_message ?? ""}>
                    {ev.error_message}
                  </TableCell>
                  <TableCell>
                    {expanded === ev.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </TableCell>
                </TableRow>
                {expanded === ev.id && (
                  <TableRow key={`${ev.id}-detail`}>
                    <TableCell colSpan={6} className="bg-muted/30">
                      <pre className="text-[10px] overflow-x-auto max-h-40 whitespace-pre-wrap">
                        {JSON.stringify(ev.payload_json, null, 2)}
                      </pre>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
