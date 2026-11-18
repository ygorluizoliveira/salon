-- =============================================================================
-- Rosi Coiffeur — Patch 3: segurança (RLS por papel) + agendamento
-- =============================================================================
-- COMO RODAR
--  1. Rode antes: supabase_setup_consolidated.sql (e, se quiser, supabase_patch_seed_orphan.sql;
--     este arquivo já inclui o seed/anon/trigger daquele patch, então ele o substitui).
--  2. Dashboard > SQL Editor > cole este arquivo inteiro > Run. É idempotente.
--  3. PROMOVER ADMIN (rode separadamente, trocando o e-mail; o usuário precisa
--     existir em Authentication > Users e fazer logout/login depois):
--
--       update auth.users
--          set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
--        where email = 'admin@seudominio.com';
--
--     Remover: ... raw_app_meta_data = raw_app_meta_data - 'role' ...
--     app_metadata só pode ser alterado pelo Dashboard/service role, nunca pelo cliente.
--  4. ATENÇÃO: depois deste patch, quem NÃO tiver role=admin perde acesso ao painel
--     administrativo (finanças, fornecedores etc.). Promova o admin antes de testar.
-- =============================================================================

create extension if not exists btree_gist;

-- ---------------------------------------------------------------------------
-- Helper de papel
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

create or replace function public.is_own_client(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.clients c where c.id = cid and c.user_id = auth.uid())
$$;

-- ---------------------------------------------------------------------------
-- Seed idempotente (settings / working_hours)
-- ---------------------------------------------------------------------------
insert into settings (salon_name)
select 'Rosi Coiffeur' where not exists (select 1 from settings);

insert into working_hours (day_of_week, open_time, close_time, active)
select v.d, v.o::time, v.c::time, v.a
from (values
  (0, '09:00', '18:00', false), (1, '09:00', '18:00', true), (2, '09:00', '18:00', true),
  (3, '09:00', '18:00', true),  (4, '09:00', '18:00', true), (5, '09:00', '18:00', true),
  (6, '09:00', '14:00', true)
) as v(d, o, c, a)
where not exists (select 1 from working_hours w where w.day_of_week = v.d);

-- ---------------------------------------------------------------------------
-- RLS: remove TODAS as policies antigas dessas tabelas e recria por papel
-- ---------------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname from pg_policies
     where schemaname = 'public'
       and tablename in ('clients','service_categories','appointments','transactions','suppliers',
                         'supplier_products','service_history','settings','working_hours',
                         'promotions','client_passkeys')
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

alter table clients            enable row level security;
alter table service_categories enable row level security;
alter table appointments       enable row level security;
alter table transactions       enable row level security;
alter table suppliers          enable row level security;
alter table supplier_products  enable row level security;
alter table service_history    enable row level security;
alter table settings           enable row level security;
alter table working_hours      enable row level security;
alter table promotions         enable row level security;
alter table client_passkeys    enable row level security;

-- Somente admin (escrita e leitura)
do $$
declare t text;
begin
  foreach t in array array['transactions','suppliers','supplier_products'] loop
    execute format('create policy %I on %I for all to authenticated using (public.is_admin()) with check (public.is_admin())',
                   'admin all', t);
  end loop;
end $$;

-- Leitura pública (anon + autenticados); escrita só admin
create policy "admin write"  on settings           for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public read"  on settings           for select to anon, authenticated using (true);
create policy "admin write"  on working_hours      for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public read"  on working_hours      for select to anon, authenticated using (true);
create policy "admin write"  on promotions         for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public read"  on promotions         for select to anon, authenticated using (active or public.is_admin());
create policy "admin write"  on service_categories for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "public read"  on service_categories for select to anon, authenticated using (status = 'active' or public.is_admin());

-- Clientes: admin tudo; cliente lê/cria/altera só a própria linha (sem delete)
create policy "admin all"   on clients for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "own select"  on clients for select to authenticated using (user_id = auth.uid());
create policy "own insert"  on clients for insert to authenticated with check (user_id = auth.uid());
create policy "own update"  on clients for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Histórico e passkeys: admin tudo; cliente só os próprios
create policy "admin all"  on service_history for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "own select" on service_history for select to authenticated using (public.is_own_client(client_id));
create policy "admin all"  on client_passkeys for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "own select" on client_passkeys for select to authenticated using (public.is_own_client(client_id));
create policy "own insert" on client_passkeys for insert to authenticated with check (public.is_own_client(client_id));
create policy "own update" on client_passkeys for update to authenticated using (public.is_own_client(client_id)) with check (public.is_own_client(client_id));

-- Agendamentos
--  * admin: tudo
--  * cliente: cria e altera (cancela) só os próprios
--  * leitura de ocupação: o front consulta appointments direto para calcular horários livres,
--    então autenticados precisam ver as linhas (date/hora/status). Trade-off: também veem
--    client_id/service/price/professional de outros, mas NÃO conseguem ler o cliente
--    (clients é protegido). Para fechar isso depois, trocar por uma RPC security definer.
create policy "admin all"          on appointments for all    to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "authenticated read" on appointments for select to authenticated using (true);
create policy "own insert"         on appointments for insert to authenticated with check (public.is_own_client(client_id));
create policy "own update"         on appointments for update to authenticated using (public.is_own_client(client_id)) with check (public.is_own_client(client_id));
create policy "anon read slots"    on appointments for select to anon using (true);

-- anon só enxerga colunas de disponibilidade
revoke select on appointments from anon;
grant  select (date, time_start, time_end, status) on appointments to anon;

-- ---------------------------------------------------------------------------
-- (2) Sem agendamento sobreposto (ignora cancelados)
-- ---------------------------------------------------------------------------
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'appointments_no_overlap') then
    alter table appointments
      add constraint appointments_no_overlap
      exclude using gist (
        tsrange((date + time_start), (date + time_end), '[)') with &&
      ) where (status <> 'Cancelado');
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- (3) Regras para não-admin em appointments (datas passadas, status, edição)
--     auth.uid() nulo (SQL Editor / service role) não sofre restrição.
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
    -- cliente só pode cancelar; nada mais muda
    if new.client_id is distinct from old.client_id
       or new.service is distinct from old.service
       or new.date is distinct from old.date
       or new.time_start is distinct from old.time_start
       or new.time_end is distinct from old.time_end
       or new.price is distinct from old.price
       or new.professional is distinct from old.professional
       or new.status not in (old.status, 'Cancelado') then
      raise exception 'Clientes só podem cancelar o próprio agendamento.' using errcode = 'insufficient_privilege';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_appointments_guard on appointments;
create trigger trg_appointments_guard
  before insert or update on appointments
  for each row execute function public.appointments_guard();

-- Cliente não pode trocar user_id nem status da própria linha
create or replace function public.clients_guard()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if tg_op = 'UPDATE' and (new.user_id is distinct from old.user_id or new.status is distinct from old.status) then
    raise exception 'Campo não editável.' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clients_guard on clients;
create trigger trg_clients_guard
  before update on clients
  for each row execute function public.clients_guard();

-- ---------------------------------------------------------------------------
-- (4) Anti-conta-órfã: cria clients junto com o usuário do Auth (mesma transação)
--     Ativa só com signUp options.data = { is_client: true, name, phone, address }.
--     Front precisará buscar por user_id em vez de INSERT (senão viola o índice único).
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
-- Storage de avatares: leitura pública; alterar/apagar só o dono do objeto ou admin
-- ---------------------------------------------------------------------------
drop policy if exists "avatars authenticated update" on storage.objects;
drop policy if exists "avatars authenticated delete" on storage.objects;
drop policy if exists "avatars owner update" on storage.objects;
drop policy if exists "avatars owner delete" on storage.objects;
create policy "avatars owner update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (owner = auth.uid() or public.is_admin()))
  with check (bucket_id = 'avatars' and (owner = auth.uid() or public.is_admin()));
create policy "avatars owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (owner = auth.uid() or public.is_admin()));

-- ---------------------------------------------------------------------------
-- Conferência manual (opcional)
-- ---------------------------------------------------------------------------
-- select (select count(*) from settings) s, (select count(*) from working_hours) w;
-- select tablename, policyname, roles, cmd from pg_policies where schemaname = 'public' order by 1, 2;
-- select u.id, u.email from auth.users u left join public.clients c on c.user_id = u.id where c.id is null; -- órfãs
