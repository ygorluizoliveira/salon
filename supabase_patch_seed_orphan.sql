-- =============================================================================
-- Rosi Coiffeur — Patch 2: seed robusto, leitura anônima e anti-conta-órfã
-- Rode DEPOIS de supabase_setup_consolidated.sql. Idempotente.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) SEED (sem ON CONFLICT: funciona mesmo se a tabela já existia sem UNIQUE)
-- ---------------------------------------------------------------------------
insert into settings (salon_name)
select 'Rosi Coiffeur' where not exists (select 1 from settings);

insert into working_hours (day_of_week, open_time, close_time, active)
select v.d, v.o::time, v.c::time, v.a
from (values
  (0, '09:00', '18:00', false),
  (1, '09:00', '18:00', true),
  (2, '09:00', '18:00', true),
  (3, '09:00', '18:00', true),
  (4, '09:00', '18:00', true),
  (5, '09:00', '18:00', true),
  (6, '09:00', '14:00', true)
) as v(d, o, c, a)
where not exists (select 1 from working_hours w where w.day_of_week = v.d);

-- Conferência (deve retornar 1 e 7):
-- select (select count(*) from settings) as settings, (select count(*) from working_hours) as working_hours;

-- ---------------------------------------------------------------------------
-- 2) LEITURA ANÔNIMA — causa provável de "sem horários" mesmo com seed:
--    login por passkey não cria sessão Supabase (role anon), e a RLS só
--    liberava 'authenticated', então settings/working_hours voltavam vazias.
-- ---------------------------------------------------------------------------
drop policy if exists "anon read settings"       on settings;
drop policy if exists "anon read working_hours"  on working_hours;
drop policy if exists "anon read promotions"     on promotions;
drop policy if exists "anon read service_categories" on service_categories;
create policy "anon read settings"       on settings           for select to anon using (true);
create policy "anon read working_hours"  on working_hours      for select to anon using (true);
create policy "anon read promotions"     on promotions         for select to anon using (active);
create policy "anon read service_categories" on service_categories for select to anon using (status = 'active');

-- Disponibilidade: anon só enxerga data/horário/status (sem client_id).
drop policy if exists "anon read appointment slots" on appointments;
create policy "anon read appointment slots" on appointments for select to anon using (true);
revoke select on appointments from anon;
grant  select (date, time_start, time_end, status) on appointments to anon;

-- ---------------------------------------------------------------------------
-- 3) ANTI-CONTA-ÓRFÃ: cria clients automaticamente quando o usuário do Auth
--    é criado, na mesma transação (se falhar, o signUp inteiro é desfeito).
--    Só age quando o signUp envia options.data = { is_client: true, name, phone, address }.
--    Admins (signUp sem esse flag) não geram linha em clients.
--    Exige ajuste no front: ClientAuthContext.signUp passar esses metadados e,
--    em vez de INSERT, buscar a linha por user_id (ou fazer upsert onConflict user_id).
-- ---------------------------------------------------------------------------
create unique index if not exists uq_clients_user_id on clients(user_id) where user_id is not null;

create or replace function public.handle_new_client_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data->>'is_client', 'false') = 'true' then
    insert into public.clients (user_id, name, email, phone, address, status, member_since)
    values (
      new.id,
      coalesce(nullif(trim(new.raw_user_meta_data->>'name'), ''), split_part(new.email, '@', 1)),
      new.email,
      nullif(trim(new.raw_user_meta_data->>'phone'), ''),
      nullif(trim(new.raw_user_meta_data->>'address'), ''),
      'Ativo',
      current_date
    )
    on conflict (user_id) where user_id is not null do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_client on auth.users;
create trigger on_auth_user_created_client
  after insert on auth.users
  for each row execute function public.handle_new_client_user();

-- ---------------------------------------------------------------------------
-- 4) Diagnóstico/limpeza de contas órfãs já existentes (rodar manualmente)
-- ---------------------------------------------------------------------------
-- select u.id, u.email, u.created_at
--   from auth.users u left join public.clients c on c.user_id = u.id
--  where c.id is null;
