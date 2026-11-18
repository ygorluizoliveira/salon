-- =============================================================================
-- Rosi Coiffeur — Patch 4: privacidade de agenda, guard de cancelamento, reminders
-- =============================================================================
-- ORDEM DE EXECUÇÃO (SQL Editor do Dashboard, cada arquivo inteiro, idempotentes):
--   1. supabase_setup_consolidated.sql
--   2. supabase_patch_security_booking.sql   (obrigatório antes deste: cria is_admin(),
--                                             is_own_client(), appointments_guard etc.)
--   3. supabase_patch_privacy_reminders.sql  (este arquivo)
--   (supabase_patch_seed_orphan.sql é dispensável: foi absorvido pelo patch 2)
--
-- CONTRATO PARA O FRONT
--   * Horários ocupados: supabase.rpc('get_busy_slots', { from_date: 'YYYY-MM-DD', to_date: 'YYYY-MM-DD' })
--     retorna linhas { date, time_start, time_end } de agendamentos NÃO cancelados.
--     Chamável por anon e authenticated. Intervalo máx. 120 dias.
--   * Cancelamento pelo cliente: UPDATE appointments SET status = 'Cancelado' WHERE id = ...
--     (NÃO existe DELETE para cliente). Qualquer outra alteração é bloqueada pelo trigger;
--     confirmar/remarcar/alterar preço é só admin.
--   * Cliente só lê os próprios agendamentos via SELECT direto; admin lê tudo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- (1) Privacidade: RPC de horários ocupados
-- ---------------------------------------------------------------------------
create or replace function public.get_busy_slots(from_date date, to_date date)
returns table (date date, time_start time, time_end time)
language sql
stable
security definer
set search_path = public
as $$
  select a.date, a.time_start, a.time_end
    from public.appointments a
   where a.status <> 'Cancelado'
     and a.date >= from_date
     and a.date <= least(to_date, from_date + 120)
   order by a.date, a.time_start
$$;

revoke all on function public.get_busy_slots(date, date) from public;
grant execute on function public.get_busy_slots(date, date) to anon, authenticated;

-- Remove leitura ampla; cliente lê só os próprios, admin tudo
drop policy if exists "authenticated read" on appointments;
drop policy if exists "anon read slots"    on appointments;
drop policy if exists "own select"         on appointments;
create policy "own select" on appointments for select to authenticated
  using (public.is_own_client(client_id));
-- ("admin all", "own insert" e "own update" do patch 2 permanecem)

-- anon não lê mais a tabela, nem colunas
revoke select on appointments from anon;
revoke all on appointments from anon;

-- ---------------------------------------------------------------------------
-- (2) Guard: cliente só pode cancelar (status -> 'Cancelado')
-- ---------------------------------------------------------------------------
create or replace function public.appointments_guard()
returns trigger
language plpgsql
as $$
declare
  now_local timestamp := (now() at time zone 'America/Sao_Paulo');
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if (new.date + new.time_start) < now_local then
      raise exception 'Não é possível agendar em data/horário passado.' using errcode = 'check_violation';
    end if;
    new.status := 'Aguardando';
  else
    if new.client_id    is distinct from old.client_id
       or new.service      is distinct from old.service
       or new.price        is distinct from old.price
       or new.date         is distinct from old.date
       or new.time_start   is distinct from old.time_start
       or new.time_end     is distinct from old.time_end
       or new.professional is distinct from old.professional then
      raise exception 'Clientes só podem cancelar; alterações são feitas pelo salão.' using errcode = 'insufficient_privilege';
    end if;
    -- permitido: manter o status ou mudar para 'Cancelado'
    if new.status is distinct from old.status and new.status <> 'Cancelado' then
      raise exception 'Clientes só podem cancelar o agendamento.' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_appointments_guard on appointments;
create trigger trg_appointments_guard
  before insert or update on appointments
  for each row execute function public.appointments_guard();

-- Cliente nunca apaga agendamentos (garantia explícita; sem policy de DELETE para cliente)
drop policy if exists "own delete" on appointments;

-- ---------------------------------------------------------------------------
-- (4) Lembretes (somente admin). O front atual (SendReminder) ainda é mock e não
--     referencia a tabela; estrutura inferida do uso previsto: cliente + agendamento,
--     canal (WhatsApp/SMS/E-mail), mensagem e controle de envio.
-- ---------------------------------------------------------------------------
create table if not exists reminders (
  id             uuid        primary key default gen_random_uuid(),
  client_id      uuid        references clients(id) on delete cascade,
  appointment_id uuid        references appointments(id) on delete set null,
  channel        text        not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'email')),
  message        text        not null,
  scheduled_for  timestamptz,
  sent_at        timestamptz,
  status         text        not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at     timestamptz not null default now()
);

create index if not exists idx_reminders_client      on reminders(client_id);
create index if not exists idx_reminders_appointment on reminders(appointment_id);
create index if not exists idx_reminders_status      on reminders(status, scheduled_for);

alter table reminders enable row level security;
drop policy if exists "admin all" on reminders;
create policy "admin all" on reminders for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on reminders from anon;

-- Conferência (opcional):
-- select * from get_busy_slots(current_date, current_date + 30);
-- select tablename, policyname, roles, cmd from pg_policies where tablename in ('appointments','reminders');
