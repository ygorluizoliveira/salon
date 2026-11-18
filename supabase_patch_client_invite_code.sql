-- Convite de cliente com CÓDIGO CURTO legível (ex.: ROSICOIFFEUR-482) + token forte no link.
-- ORDEM: rodar DEPOIS de supabase_patch_client_invites.sql e supabase_patch_client_invites_link.sql. Idempotente.
--
-- Desenho:
--  * O link /cliente?convite=<token 32 hex> continua sendo o segredo forte (128 bits).
--  * O código curto (NOME_DO_SALAO-NNN) serve para identificação/digitação manual. Só 1000
--    combinações: por isso é protegido por: expira em 15 min, uso único, limite por IP (10 falhas/15 min)
--    e limite GLOBAL de 10 falhas de código/15 min; ao estourar, todos os códigos pendentes são
--    DESATIVADOS (o link com token segue válido) e a tentativa por código fica bloqueada.
--  * Código guardado só como hash (sha256). Não há índice único: a unicidade entre convites ativos é
--    garantida na geração (sorteia de novo se já existir um ativo igual).
--  Risco residual: com 10 tentativas por janela, chance de acerto ≈ (convites ativos × 10)/1000 ≈ 1% por convite.
--  Um atacante também pode "queimar" os códigos (negação de serviço leve) — o link continua funcionando.

alter table public.client_invites add column if not exists code_hash text;
create index if not exists client_invites_code_hash_idx on public.client_invites (code_hash) where code_hash is not null;
alter table public.client_register_attempts add column if not exists kind text not null default 'token';

-- Normaliza: sem acentos, maiúsculo, só A-Z0-9 (para o nome) / mantém "-NNN"
create or replace function public.normalize_invite_code(p text)
returns text language sql immutable set search_path = public as $$
  select upper(regexp_replace(
    translate(coalesce(p,''),
      'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
      'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'),
    '[^A-Za-z0-9-]', '', 'g'))
$$;

drop function if exists public.create_client_invite(text, text, text, uuid);

create or replace function public.create_client_invite(
  p_name text default null, p_phone text default null,
  p_email text default null, p_client_id uuid default null)
returns table (invite_id uuid, token text, code text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token text := encode(gen_random_bytes(16), 'hex');
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_name  text := nullif(btrim(coalesce(p_name, '')), '');
  v_id    uuid;
  v_exp   timestamptz := now() + interval '15 minutes';
  v_c     public.clients%rowtype;
  v_salon text;
  v_code  text;
  v_try   int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Acesso restrito.' using errcode = 'insufficient_privilege';
  end if;

  if p_client_id is not null then
    select * into v_c from public.clients where id = p_client_id;
    if not found then raise exception 'Cliente não encontrado.'; end if;
    if v_c.user_id is not null then raise exception 'Este cliente já possui conta.'; end if;
    v_name := coalesce(v_name, v_c.name);
    update public.client_invites ci set used_at = now()
     where ci.client_id = p_client_id and ci.used_at is null;
  end if;

  select regexp_replace(public.normalize_invite_code(s.salon_name), '-', '', 'g') into v_salon
    from public.settings s order by s.created_at limit 1;
  v_salon := coalesce(nullif(v_salon, ''), 'SALAO');

  loop
    v_code := v_salon || '-' || lpad((('x' || encode(gen_random_bytes(3), 'hex'))::bit(24)::int % 1000)::text, 3, '0');
    exit when not exists (
      select 1 from public.client_invites ci
       where ci.code_hash = encode(digest(v_code, 'sha256'), 'hex')
         and ci.used_at is null and ci.expires_at > now());
    v_try := v_try + 1;
    if v_try > 50 then raise exception 'Muitos convites ativos; tente em instantes.'; end if;
  end loop;

  insert into public.client_invites (token_hash, code_hash, client_id, name, phone, email, expires_at, created_by)
  values (encode(digest(v_token, 'sha256'), 'hex'), encode(digest(v_code, 'sha256'), 'hex'), p_client_id, v_name,
          nullif(btrim(coalesce(p_phone, '')), ''), v_email, v_exp, auth.uid())
  returning id into v_id;

  return query select v_id, v_token, v_code, v_exp;
end;
$$;
revoke all on function public.create_client_invite(text, text, text, uuid) from public, anon;
grant execute on function public.create_client_invite(text, text, text, uuid) to authenticated;

-- Aceita token (32 hex) OU código curto (NOME-NNN)
create or replace function public.claim_client_invite(p_token text, p_ip text default null)
returns table (ok boolean, locked boolean, invite_id uuid, client_id uuid,
               invite_name text, invite_phone text, invite_email text)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_in      text := btrim(coalesce(p_token, ''));
  v_is_code boolean := v_in !~* '^[0-9a-f]{32}$';
  v_norm    text := public.normalize_invite_code(v_in);
  v_hash    text;
  v_inv     public.client_invites%rowtype;
  v_fail    int;
  v_kind    text;
begin
  v_kind := case when v_is_code then 'code' else 'token' end;

  select count(*) into v_fail from public.client_register_attempts
   where p_ip is not null and ip = p_ip and not success and created_at > now() - interval '15 minutes';
  if v_fail >= 10 then
    return query select false, true, null::uuid, null::uuid, null::text, null::text, null::text; return;
  end if;

  if v_is_code then
    select count(*) into v_fail from public.client_register_attempts
     where kind = 'code' and not success and created_at > now() - interval '15 minutes';
    if v_fail >= 10 then
      update public.client_invites set code_hash = null where used_at is null and code_hash is not null;
      return query select false, true, null::uuid, null::uuid, null::text, null::text, null::text; return;
    end if;
    if v_norm !~ '^[A-Z0-9]{2,40}-[0-9]{3}$' then
      insert into public.client_register_attempts (ip, success, kind) values (p_ip, false, 'code');
      return query select false, false, null::uuid, null::uuid, null::text, null::text, null::text; return;
    end if;
    v_hash := encode(digest(v_norm, 'sha256'), 'hex');
    select * into v_inv from public.client_invites
     where code_hash = v_hash and used_at is null and expires_at > now() for update;
  else
    v_hash := encode(digest(lower(v_in), 'sha256'), 'hex');
    select * into v_inv from public.client_invites
     where token_hash = v_hash and used_at is null and expires_at > now() for update;
  end if;

  if found then
    update public.client_invites set used_at = now() where id = v_inv.id;
    insert into public.client_register_attempts (ip, success, kind) values (p_ip, true, v_kind);
    return query select true, false, v_inv.id, v_inv.client_id, v_inv.name, v_inv.phone, v_inv.email; return;
  end if;

  insert into public.client_register_attempts (ip, success, kind) values (p_ip, false, v_kind);
  return query select false, false, null::uuid, null::uuid, null::text, null::text, null::text;
end;
$$;
revoke all on function public.claim_client_invite(text, text) from public, anon, authenticated;
grant execute on function public.claim_client_invite(text, text) to service_role;
