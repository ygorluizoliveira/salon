-- =============================================================================
-- Patch 8: sexo/gênero em convites de gestão e nome de exibição
-- ORDEM: após supabase_patch_staff_invites.sql. Idempotente.
-- Valores de gender: 'F' (feminino), 'M' (masculino), 'O' (outro/não informar).
-- =============================================================================
--
-- ATUALIZAR O ADMIN JÁ EXISTENTE (rode no SQL Editor, trocando 'F'/'M'/'O' pelo valor desejado):
--
--   update auth.users
--      set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
--            || jsonb_build_object('name', 'Ygor Oliveira', 'gender', 'M')   -- <- troque 'M' por 'F', 'M' ou 'O'
--    where email = 'ygorluizoliveira_2012@hotmail.com';
--
-- Depois, o usuário deve sair e entrar de novo (ou renovar a sessão) para o JWT trazer os dados.
-- =============================================================================

alter table staff_invites add column if not exists gender text;
alter table staff_invites drop constraint if exists staff_invites_gender_check;
alter table staff_invites add constraint staff_invites_gender_check check (gender is null or gender in ('F', 'M', 'O'));

-- Substitui create_staff_invite (parâmetro opcional p_gender; chamadas antigas de 3 args continuam válidas)
drop function if exists public.create_staff_invite(text, text, text);
create or replace function public.create_staff_invite(p_email text, p_cpf text, p_name text default null, p_gender text default null)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_email  text := lower(btrim(p_email));
  v_cpf    text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_gender text := nullif(upper(btrim(coalesce(p_gender, ''))), '');
  v_id     uuid;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Acesso restrito.' using errcode = 'insufficient_privilege';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then raise exception 'E-mail inválido.'; end if;
  if not public.is_valid_cpf(v_cpf) then raise exception 'CPF inválido.'; end if;
  if v_gender is not null and v_gender not in ('F', 'M', 'O') then raise exception 'Gênero inválido (use F, M ou O).'; end if;

  insert into staff_invites (email, cpf_hash, name, gender, created_by)
  values (v_email, crypt(v_cpf, gen_salt('bf', 10)), nullif(btrim(p_name), ''), v_gender, auth.uid())
  on conflict (email) do update
    set cpf_hash = excluded.cpf_hash, name = excluded.name, gender = excluded.gender,
        used_at = null, created_by = excluded.created_by
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.create_staff_invite(text, text, text, text) from public, anon;
grant execute on function public.create_staff_invite(text, text, text, text) to authenticated;

-- claim_staff_invite passa a devolver também o gênero do convite
drop function if exists public.claim_staff_invite(text, text, text);
create or replace function public.claim_staff_invite(p_email text, p_cpf text, p_ip text default null)
returns table (ok boolean, locked boolean, invite_id uuid, invite_name text, invite_gender text)
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
    return query select false, true, null::uuid, null::text, null::text; return;
  end if;

  select * into v_inv from staff_invites where email = v_email and used_at is null for update;

  if found and public.is_valid_cpf(v_cpf) and v_inv.cpf_hash = crypt(v_cpf, v_inv.cpf_hash) then
    update staff_invites set used_at = now() where id = v_inv.id;
    insert into staff_register_attempts (email_key, ip, success) values (v_email, p_ip, true);
    return query select true, false, v_inv.id, v_inv.name, v_inv.gender; return;
  end if;

  perform crypt(v_cpf, gen_salt('bf', 10));
  insert into staff_register_attempts (email_key, ip, success) values (v_email, p_ip, false);
  return query select false, false, null::uuid, null::text, null::text;
end;
$$;
revoke all on function public.claim_staff_invite(text, text, text) from public, anon, authenticated;
grant execute on function public.claim_staff_invite(text, text, text) to service_role;
