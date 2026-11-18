// Edge Function: register-staff (pública, verify_jwt = false)
// POST { email, cpf, password, name } -> cria usuário admin se houver convite válido.
// Toda falha de validação devolve a mesma mensagem genérica.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GENERIC = 'Não foi possível concluir o cadastro. Verifique os dados ou procure o administrador.';
const LOCKED = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({ error: 'Função mal configurada.' }, 500);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: GENERIC }, 400); }

  const email = String(body.email ?? '').trim().toLowerCase();
  const cpf = String(body.cpf ?? '').replace(/\D/g, '');
  const password = String(body.password ?? '');
  const name = String(body.name ?? '').trim();
  const genderInput = String(body.gender ?? '').trim().toUpperCase();
  const rawGender = ['F', 'M', 'O'].includes(genderInput) ? genderInput : null;
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;

  const fail = async (status = 400) => { await sleep(700 + Math.random() * 400); return json({ error: GENERIC }, status); };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || cpf.length !== 11
      || password.length < 8 || password.length > 72 || !name || name.length > 120) {
    return await fail();
  }

  // Reserva o convite no banco (valida limite, e-mail + CPF e marca used_at atomicamente)
  const { data: claim, error: claimErr } = await admin.rpc('claim_staff_invite', { p_email: email, p_cpf: cpf, p_ip: ip });
  if (claimErr) return await fail(500);
  const row = Array.isArray(claim) ? claim[0] : claim;
  if (row?.locked) { await sleep(1000); return json({ error: LOCKED }, 429); }
  if (!row?.ok) return await fail();

  // O gênero informado vale; senão usa o padrão do convite
  const gender = rawGender ?? (['F', 'M', 'O'].includes(row.invite_gender) ? row.invite_gender : null);

  const { error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: { name, ...(gender ? { gender } : {}) },
  });

  if (createErr) {
    await admin.rpc('release_staff_invite', { p_invite_id: row.invite_id });
    return await fail();
  }

  return json({ ok: true });
});
