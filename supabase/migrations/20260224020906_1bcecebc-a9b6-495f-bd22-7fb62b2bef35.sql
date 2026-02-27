ALTER TABLE public.whatsapp_logs
  ADD COLUMN competencia text,
  ADD COLUMN message_type text DEFAULT 'extrato_nao_enviado',
  ADD COLUMN is_resend boolean DEFAULT false,
  ADD COLUMN resend_reason text;