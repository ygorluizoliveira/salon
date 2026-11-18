-- =============================================================================
-- Patch 6: suporte ao envio de lembretes por e-mail (Edge Function send-reminder)
-- Ordem: após supabase_patch_privacy_reminders.sql (cria a tabela reminders).
-- Idempotente. Cole no SQL Editor e execute.
-- =============================================================================

-- Coluna para guardar o motivo de falha
alter table reminders add column if not exists error text;

-- Status 'sending' = reservado pela função (evita envio duplicado)
alter table reminders drop constraint if exists reminders_status_check;
alter table reminders
  add constraint reminders_status_check
  check (status in ('pending', 'sending', 'sent', 'failed'));

-- Obs.: a função usa a service role (ignora RLS); a RLS "admin all" de reminders
-- continua valendo para o front, que cria o lembrete (INSERT) como admin.
