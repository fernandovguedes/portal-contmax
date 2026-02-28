

# Fix: Replicar fluxo OneCode para Contmax

## Problema Identificado

O fluxo ja esta configurado para Contmax no webhook (header `x-onecode-source: contmax`), e o webhook JA recebe eventos (35 ate agora). Porem, **todas as 32 mensagens falham** ao serem salvas na tabela `onecode_messages_raw`.

**Erro:** `there is no unique or exclusion constraint matching the ON CONFLICT specification`

O webhook faz `upsert(..., { onConflict: "onecode_message_id" })`, mas a tabela nao tem um indice UNIQUE na coluna `onecode_message_id`.

Sem mensagens salvas, o scoring por IA nunca e acionado quando o ticket fecha.

## Solucao

### 1. Criar indice UNIQUE na coluna `onecode_message_id`

```sql
CREATE UNIQUE INDEX IF NOT EXISTS onecode_messages_raw_onecode_message_id_key 
ON public.onecode_messages_raw (onecode_message_id);
```

Isso resolve o upsert e permite que mensagens sejam salvas corretamente.

### 2. Reprocessar os 32 eventos pendentes

Apos criar o indice, os proximos webhooks funcionarao automaticamente. Mas os 32 eventos ja recebidos estao com `processed = false`. Para reprocessa-los, criaremos uma query que extrai os dados do `payload_json` de cada evento pendente e insere diretamente na `onecode_messages_raw`.

### 3. Verificacao

- Confirmar que mensagens Contmax aparecem em `onecode_messages_raw`
- Confirmar que quando um ticket Contmax fechar, o scoring sera disparado automaticamente (ja esta no codigo do webhook)
- A pagina Qualidade de Atendimento ja suporta filtro por tenant, entao os scores Contmax aparecerao automaticamente

## Detalhes Tecnicos

- Nenhuma mudanca no codigo das Edge Functions e necessaria -- o `onecode-webhook` e o `onecode-score-ticket` ja suportam multiplas organizacoes
- A unica mudanca e no banco de dados: adicionar o indice UNIQUE faltante
- O reprocessamento dos eventos pendentes sera feito via SQL migration

