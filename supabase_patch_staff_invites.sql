-- =============================================================================
-- Patch 7: convites de gestão (staff_invites) + cadastro validado no servidor
-- ORDEM: após supabase_patch_security_booking.sql (usa is_admin()). Idempotente.
-- Funciona junto com a Edge Function supabase/functions/register-staff.
-- O CPF NUNCA é guardado em claro: só hash bcrypt (pgcrypto crypt/gen_salt).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists staff_invites (
  id         uuid        primary key default gen_random_uuid(),
  email      text        not null,
  cpf_hash   text        not null,
  name       text,
  created_by uuid        references auth.users(id) on delete set null,
  used_at    timestamptz,
  created_at timestamptz not null default now(),
  constraint staff_invites_email_lower check (email = lower(btrim(email)))
);
create unique index if not exists uq_staff_invites_email on staff_invites (email);

create table if not exists staff_register_attempts (
  id         bigint generated always as identity primary key,
  email_key  text        not null,
  ip         text,
  success    boolean     not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_staff_attempts_email on staff_register_attempts (email_key, created_at);
create index if not exists idx_staff_attempts_ip    on staff_register_attempts (ip, created_at);

alter table staff_invites           enable row level security;
alter table staff_register_attempts enable row level security;
drop policy if exists "admin all" on staff_invites;
create policy "admin all" on staff_invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
-- attempts: sem policy = ninguém (só service role / funções security definer)
revoke all on staff_invites, staff_register_attempts from anon, authenticated;
grant select, insert, update, delete on staff_invites to authenticated; -- continua filtrado pela RLS

-- Validação de dígitos verificadores do CPF
create or replace function public.is_valid_cpf(cpf text)
returns boolean
language plpgsql
immutable
as $$
declare
  d text := regexp_replace(coalesce(cpf, ''), '\D', '', 'g');
  s int; r int; i int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0; for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::int then return false; end if;
  s := 0; for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  return r = substr(d, 11, 1)::int;
end;
$$;

-- Admin (ou SQL Editor) cria/renova convite. Reemitir convite já usado reabre-o.
create or replace function public.create_staff_invite(p_email text, p_cpf text, p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(btrim(p_email));
  v_cpf   text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_id    uuid;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Acesso restrito.' using errcode = 'insufficient_privilege';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'E-mail inválido.'; end if;
  if not public.is_valid_cpf(v_cpf) then raise exception 'CPF inválido.'; end if;

  insert into staff_invites (email, cpf_hash, name, created_by)
  values (v_email, crypt(v_cpf, gen_salt('bf', 10)), nullif(btrim(p_name), ''), auth.uid())
  on conflict (email) do update
    set cpf_hash = excluded.cpf_hash, name = excluded.name, used_at = null, created_by = excluded.created_by
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_staff_invite(text, text, text) from public, anon;
grant execute on function public.create_staff_invite(text, text, text) to authenticated;

-- Usada SÓ pela Edge Function (service role): valida limite, confere e-mail+CPF e
-- "reserva" o convite atomicamente. Retorna o nome do convite ou null (falha genérica).
create or replace function public.claim_staff_invite(p_email text, p_cpf text, p_ip text default null)
returns table (ok boolean, locked boolean, invite_id uuid, invite_name text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email text := lower(btrim(p_email));
  v_cpf   text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_inv   staff_invites%rowtype;
  v_fail_email int;
  v_fail_ip    int;
begin
  select count(*) into v_fail_email from staff_register_attempts
   where email_key = v_email and not success and created_at > now() - interval '15 minutes';
  select count(*) into v_fail_ip from staff_register_attempts
   where p_ip is not null and ip = p_ip and not success and created_at > now() - interval '15 minutes';

  if v_fail_email >= 5 or v_fail_ip >= 20 then
    return query select false, true, null::uuid, null::text; return;
  end if;

  select * into v_inv from staff_invites where email = v_email and used_at is null for update;

  -- bcrypt é executado mesmo sem convite (tempo parecido, sem revelar existência)
  if found and public.is_valid_cpf(v_cpf) and v_inv.cpf_hash = crypt(v_cpf, v_inv.cpf_hash) then
    update staff_invites set used_at = now() where id = v_inv.id;
    insert into staff_register_attempts (email_key, ip, success) values (v_email, p_ip, true);
    return query select true, false, v_inv.id, v_inv.name; return;
  end if;

  perform crypt(v_cpf, gen_salt('bf', 10));
  insert into staff_register_attempts (email_key, ip, success) values (v_email, p_ip, false);
  return query select false, false, null::uuid, null::text;
end;
$$;
revoke all on function public.claim_staff_invite(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_staff_invite(text, text, text) to service_role;

-- Reabre o convite se a criação do usuário falhar depois da reserva
create or replace function public.release_staff_invite(p_invite_id uuid)
returns void
language sql
security definer
set search_path = public
as $$ update staff_invites set used_at = null where id = p_invite_id $$;
revoke all on function public.release_staff_invite(uuid) from public, anon, authenticated;
grant execute on function public.release_staff_invite(uuid) to service_role;

-- Limpeza opcional de tentativas antigas (rodar manualmente ou via pg_cron)
-- delete from staff_register_attempts where created_at < now() - interval '7 days';
