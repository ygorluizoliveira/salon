-- =============================================================================
-- Patch 9: cadastro de CLIENTE somente por convite (client_invites)
-- ORDEM: após supabase_patch_security_booking.sql (is_admin) e supabase_patch_staff_invites.sql
-- (reaproveita nada dele, mas mantém a mesma convenção). Idempotente.
-- Funciona junto com a Edge Function supabase/functions/register-client.
-- O token é guardado só como hash SHA-256 (token tem 128 bits aleatórios).
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists client_invites (
  id         uuid        primary key default gen_random_uuid(),
  token_hash text        not null unique,
  client_id  uuid        references clients(id) on delete cascade,
  name       text        not null,
  phone      text,
  email      text,
  expires_at timestamptz not null default now() + interval '7 days',
  used_at    timestamptz,
  created_by uuid        references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint client_invites_email_lower check (email is null or email = lower(btrim(email)))
);
create index if not exists idx_client_invites_client on client_invites (client_id);

create table if not exists client_register_attempts (
  id         bigint generated always as identity primary key,
  ip         text,
  success    boolean     not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_client_attempts_ip on client_register_attempts (ip, created_at);

alter table client_invites           enable row level security;
alter table client_register_attempts enable row level security;
drop policy if exists "admin all" on client_invites;
create policy "admin all" on client_invites for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on client_invites, client_register_attempts from anon, authenticated;
grant select, update, delete on client_invites to authenticated; -- filtrado pela RLS (insert só via RPC)

-- Admin gera o convite. Devolve o token em claro UMA vez (não é recuperável depois).
create or replace function public.create_client_invite(
  p_name text, p_phone text, p_email text default null, p_client_id uuid default null)
returns table (invite_id uuid, token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(16), 'hex');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_id    uuid;
  v_exp   timestamptz := now() + interval '7 days';
  v_c     public.clients%rowtype;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Acesso restrito.' using errcode = 'insufficient_privilege';
  end if;

  if p_client_id is not null then
    select * into v_c from public.clients where id = p_client_id;
    if not found then raise exception 'Cliente não encontrado.'; end if;
    if v_c.user_id is not null then raise exception 'Este cliente já possui conta.'; end if;
    v_name := coalesce(v_name, v_c.name);
  end if;
  if v_name is null then raise exception 'Nome é obrigatório.'; end if;

  -- invalida convites pendentes anteriores do mesmo cliente
  if p_client_id is not null then
    update public.client_invites ci set used_at = now()
     where ci.client_id = p_client_id and ci.used_at is null;
  end if;

  insert into public.client_invites (token_hash, client_id, name, phone, email, expires_at, created_by)
  values (encode(digest(v_token, 'sha256'), 'hex'), p_client_id, v_name,
          nullif(btrim(coalesce(p_phone, '')), ''), v_email, v_exp, auth.uid())
  returning id into v_id;

  return query select v_id, v_token, v_exp;
end;
$$;
revoke all on function public.create_client_invite(text, text, text, uuid) from public, anon;
grant execute on function public.create_client_invite(text, text, text, uuid) to authenticated;

-- Só a Edge Function (service role): limite por IP + reserva atômica do convite
create or replace function public.claim_client_invite(p_token text, p_ip text default null)
returns table (ok boolean, locked boolean, invite_id uuid, client_id uuid,
               invite_name text, invite_phone text, invite_email text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text := encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  v_inv  public.client_invites%rowtype;
  v_fail int;
begin
  select count(*) into v_fail from public.client_register_attempts
   where p_ip is not null and ip = p_ip and not success and created_at > now() - interval '15 minutes';
  if v_fail >= 10 then
    return query select false, true, null::uuid, null::uuid, null::text, null::text, null::text; return;
  end if;

  select * into v_inv from public.client_invites
   where token_hash = v_hash and used_at is null and expires_at > now() for update;

  if found then
    update public.client_invites set used_at = now() where id = v_inv.id;
    insert into public.client_register_attempts (ip, success) values (p_ip, true);
    return query select true, false, v_inv.id, v_inv.client_id, v_inv.name, v_inv.phone, v_inv.email; return;
  end if;

  insert into public.client_register_attempts (ip, success) values (p_ip, false);
  return query select false, false, null::uuid, null::uuid, null::text, null::text, null::text;
end;
$$;
revoke all on function public.claim_client_invite(text, text) from public, anon, authenticated;
grant execute on function public.claim_client_invite(text, text) to service_role;

create or replace function public.release_client_invite(p_invite_id uuid)
returns void
language sql
security definer
set search_path = public
as $$ update public.client_invites set used_at = null where id = p_invite_id $$;
revoke all on function public.release_client_invite(uuid) from public, anon, authenticated;
grant execute on function public.release_client_invite(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- DESLIGAR auto-cadastro no banco
--  * Remove o trigger que criava clients a partir de metadados do signUp público
--    (qualquer um poderia enviar is_client=true). Agora só a Edge Function cria/vincula.
--  * Remove a policy que deixava um usuário autenticado inserir a própria linha em clients.
-- ---------------------------------------------------------------------------
drop trigger if exists on_auth_user_created_client on auth.users;
drop function if exists public.handle_new_client_user();
drop policy if exists "own insert" on clients;
