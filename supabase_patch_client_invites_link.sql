-- Convite de cliente = só um LINK (token), válido por 15 minutos, uso único.
-- ORDEM: rodar DEPOIS de supabase_patch_client_invites.sql. Idempotente.
-- Nome/telefone/e-mail passam a ser informados pelo cliente no cadastro (register-client).

alter table public.client_invites alter column name drop not null;
alter table public.client_invites alter column expires_at set default now() + interval '15 minutes';

drop function if exists public.create_client_invite(text, text, text, uuid);

create or replace function public.create_client_invite(
  p_name text default null, p_phone text default null,
  p_email text default null, p_client_id uuid default null)
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
  v_exp   timestamptz := now() + interval '15 minutes';
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
