// Edge Function: register-client (pública, verify_jwt = false)
// POST { token, email, password, name?, phone?, address? } -> cria conta de cliente via convite.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GENERIC = 'Convite inválido ou expirado. Peça um novo convite ao salão.';
const LOCKED = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
const clean = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);

// Telefone BR: remove +55, 10/11 dígitos, DDD 11-99, 9º dígito = 9 se 11 dígitos. Retorna "(DD) 9XXXX-XXXX" / "(DD) XXXX-XXXX" ou null.
function normalizePhone(v: string): string | null {
  let d = v.replace(/\D/g, '');
  if ((d.length === 12 || d.length === 13) && d.startsWith('55')) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = Number(d.slice(0, 2));
  if (ddd < 11 || ddd > 99) return null;
  if (d.length === 11 && d[2] !== '9') return null;
  return d.length === 11
    ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
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

  // aceita token (32 hex) ou código curto (NOME-NNN) em body.token ou body.code
  const token = clean(body.token ?? body.code, 100);
  const isHex = /^[0-9a-f]{32}$/i.test(token);
  const password = String(body.password ?? '');
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || null;
  const fail = async (status = 400) => { await sleep(700 + Math.random() * 400); return json({ error: GENERIC }, status); };

  if (!isHex && !/^[A-Za-z0-9 -]{3,60}$/.test(token.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return await fail();
  if (password.length < 8 || password.length > 72) {
    return json({ error: 'A senha deve ter entre 8 e 72 caracteres.' }, 400);
  }

  const { data: claim, error: claimErr } = await admin.rpc('claim_client_invite', { p_token: isHex ? token.toLowerCase() : token.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '').toUpperCase(), p_ip: ip });
  if (claimErr) return await fail(500);
  const row = Array.isArray(claim) ? claim[0] : claim;
  if (row?.locked) { await sleep(1000); return json({ error: LOCKED }, 429); }
  if (!row?.ok) return await fail();

  const email = (row.invite_email ?? clean(body.email, 254)).toLowerCase();
  const name = row.invite_name || clean(body.name, 120);
  const phone = normalizePhone(row.invite_phone || clean(body.phone, 30));
  const address = clean(body.address, 200) || null;

  const release = async () => { await admin.rpc('release_client_invite', { p_invite_id: row.invite_id }); };

  if (!phone) {
    await release();
    return json({ error: 'Telefone inválido.' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name) {
    await release();
    return json({ error: 'Informe um e-mail válido.' }, 400);
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { is_client: true, name, phone, address },
  });
  if (createErr || !created?.user) {
    await release();
    // não revela se o e-mail já existe
    return json({ error: 'Não foi possível criar a conta. Verifique os dados ou procure o salão.' }, 400);
  }
  const userId = created.user.id;

  // Vincula ao cliente existente (apenas se ainda sem conta) ou cria novo
  let linkErr: unknown = null;
  if (row.client_id) {
    const { data, error } = await admin.from('clients')
      .update({ user_id: userId, email, ...(address ? { address } : {}) })
      .eq('id', row.client_id).is('user_id', null).select('id');
    linkErr = error ?? (data && data.length ? null : new Error('cliente indisponível'));
  } else {
    const { error } = await admin.from('clients').insert({
      user_id: userId, name, email, phone, address, status: 'Ativo',
    });
    linkErr = error;
  }

  if (linkErr) {
    await admin.auth.admin.deleteUser(userId); // sem conta órfã
    await release();
    return await fail(500);
  }

  return json({ ok: true });
});
