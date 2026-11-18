-- =============================================================================
-- Rosi Coiffeur — Patch 5: dias fechados e expediente em appointments
-- =============================================================================
-- ORDEM DE EXECUÇÃO (cada arquivo inteiro, idempotentes):
--   1. supabase_setup_consolidated.sql
--   2. supabase_patch_security_booking.sql   (cria is_admin())
--   3. supabase_patch_privacy_reminders.sql
--   4. supabase_patch_closed_days.sql        (este arquivo)
--
-- FORMATOS CONFIRMADOS NO FRONT
--   * settings.closed_dates: text[] com datas ISO 'YYYY-MM-DD' (WorkingHours.tsx grava
--     dateIso; useScheduling/ClientBooking comparam com a data ISO).
--   * working_hours: day_of_week 0=domingo..6=sábado (JS getDay), open_time/close_time (time), active.
--   * Dia sem linha em working_hours é tratado como fechado (igual ao front).
--
-- REGRA (somente não-admin; admin e SQL Editor/service role são isentos):
--   INSERT, ou UPDATE que altere data/horário: rejeita se (a) data em closed_dates,
--   (b) dia inativo ou sem expediente, (c) início < open_time ou fim > close_time.
--   Cancelar (UPDATE só de status) continua permitido em qualquer data.
-- =============================================================================

create or replace function public.appointments_hours_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wh public.working_hours%rowtype;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.date       is not distinct from old.date
     and new.time_start is not distinct from old.time_start
     and new.time_end   is not distinct from old.time_end then
    return new;
  end if;

  if exists (select 1 from public.settings s where new.date::text = any (coalesce(s.closed_dates, '{}'))) then
    raise exception 'O salão está fechado nesta data.' using errcode = 'check_violation';
  end if;

  select * into wh from public.working_hours w where w.day_of_week = extract(dow from new.date)::int;

  if not found or not wh.active then
    raise exception 'O salão não atende neste dia da semana.' using errcode = 'check_violation';
  end if;

  if new.time_start < wh.open_time or new.time_end > wh.close_time then
    raise exception 'Horário fora do expediente (% às %).',
      to_char(wh.open_time, 'HH24:MI'), to_char(wh.close_time, 'HH24:MI')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_appointments_hours_guard on appointments;
create trigger trg_appointments_hours_guard
  before insert or update on appointments
  for each row execute function public.appointments_hours_guard();

-- Teste manual (logado como cliente, via API) deve falhar em domingo/data fechada:
-- insert into appointments (client_id, service, date, time_start, time_end) values (...);
