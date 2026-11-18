// Edge Function: send-reminder
// POST { reminder_id: string }  (Authorization: Bearer <JWT do admin>)
// Envia o lembrete por e-mail via Resend e atualiza reminders.status/sent_at.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromAddress = Deno.env.get('REMINDER_FROM') ?? 'Salão <onboarding@resend.dev>';
  if (!supabaseUrl || !serviceKey || !resendKey) {
    return json({ error: 'Função mal configurada (secrets ausentes).' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // 1) Autenticação: JWT válido + app_metadata.role = 'admin'
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Não autenticado.' }, 401);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) return json({ error: 'Sessão inválida.' }, 401);
  if (userData.user.app_metadata?.role !== 'admin') return json({ error: 'Acesso restrito ao administrador.' }, 403);

  // 2) Entrada
  let reminderId: string | undefined;
  try {
    reminderId = (await req.json())?.reminder_id;
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }
  if (!reminderId || !/^[0-9a-f-]{36}$/i.test(reminderId)) return json({ error: 'reminder_id inválido.' }, 400);

  // 3) Reserva atômica (evita envio duplicado): pending/failed -> sending
  const { data: claimed, error: claimErr } = await admin
    .from('reminders')
    .update({ status: 'sending', error: null })
    .eq('id', reminderId)
    .in('status', ['pending', 'failed'])
    .select('id, client_id, appointment_id, channel, message')
    .maybeSingle();
  if (claimErr) return json({ error: claimErr.message }, 500);
  if (!claimed) return json({ error: 'Lembrete não encontrado ou já enviado/em envio.' }, 409);

  async function fail(message: string, status = 502) {
    await admin.from('reminders').update({ status: 'failed', error: message.slice(0, 500) }).eq('id', reminderId);
    return json({ error: message }, status);
  }

  if (claimed.channel !== 'email') return fail('Este lembrete não é do canal e-mail.', 400);

  // 4) Destinatário e dados do salão
  const { data: client } = claimed.client_id
    ? await admin.from('clients').select('name, email').eq('id', claimed.client_id).maybeSingle()
    : { data: null };
  const to = client?.email?.trim();
  if (!to) return fail('Cliente sem e-mail cadastrado.', 422);

  const { data: salon } = await admin.from('settings').select('salon_name, email').limit(1).maybeSingle();
  const salonName = salon?.salon_name ?? 'Salão';

  // 5) Envio via Resend
  const html = `<div style="font-family:Arial,sans-serif;color:#35313a;line-height:1.6">
    <p>${escapeHtml(claimed.message).replace(/\n/g, '<br>')}</p>
    <p style="color:#625d67;font-size:13px">— ${escapeHtml(salonName)}</p></div>`;

  let resp: Response;
  try {
    resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromAddress,
        to: [to],
        subject: `Lembrete de agendamento — ${salonName}`,
        html,
        text: claimed.message,
        ...(salon?.email ? { reply_to: salon.email } : {}),
      }),
    });
  } catch (e) {
    return fail(`Falha de rede ao chamar o Resend: ${(e as Error).message}`);
  }

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    return fail(`Resend ${resp.status}: ${detail}`);
  }

  const result = await resp.json().catch(() => ({}));
  await admin.from('reminders').update({ status: 'sent', sent_at: new Date().toISOString(), error: null }).eq('id', reminderId);
  return json({ ok: true, id: reminderId, provider_id: result?.id ?? null });
});
