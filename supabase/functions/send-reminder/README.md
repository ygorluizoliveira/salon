# send-reminder — lembretes por e-mail (Resend)

## Passo a passo (projeto `nqaegttmdxuoblqixkfq`)

1. **SQL:** no SQL Editor rode `supabase_patch_reminders_email.sql` (depois dos patches anteriores).
2. **Resend:** crie conta em https://resend.com e gere uma API Key (Settings > API Keys).
   - Teste: sem domínio, o remetente padrão `onboarding@resend.dev` só envia para o e-mail dono da conta Resend.
   - Produção: verifique seu domínio em Resend > Domains e use um remetente desse domínio.
3. **Secrets** (nunca coloque a chave em arquivos/código). Via CLI:
   ```
   npm i -g supabase            # ou: npx supabase ...
   supabase login
   supabase link --project-ref nqaegttmdxuoblqixkfq
   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
   supabase secrets set REMINDER_FROM="Rosi Coiffeur <lembretes@seudominio.com>"
   ```
   Ou pelo painel: Edge Functions > Secrets > Add new secret. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetados automaticamente.
4. **Deploy** (na raiz do repositório):
   ```
   supabase functions deploy send-reminder
   ```
   Pelo painel: Edge Functions > Deploy a new function > cole `index.ts`, nome `send-reminder`. Mantenha "Verify JWT" ligado.
5. **Admin:** o usuário precisa ter `app_metadata.role = 'admin'` (veja `supabase_patch_security_booking.sql`) e fazer login de novo.
6. **Teste:** crie uma linha em `reminders` (channel `email`, cliente com e-mail) e chame a função (abaixo). Logs: Edge Functions > send-reminder > Logs.

## Chamada (frontend, usuário admin logado)

```ts
const { data, error } = await supabase.functions.invoke('send-reminder', {
  body: { reminder_id },   // uuid de reminders.id
});
// sucesso: { ok: true, id, provider_id }
// erro: error (FunctionsHttpError) com JSON { error: string }
```

O fluxo: o front faz `insert` em `reminders` (`client_id`, `appointment_id?`, `channel: 'email'`, `message`) e depois invoca a função com o `id` retornado.

| HTTP | Significado |
|------|-------------|
| 200  | Enviado (`status='sent'`, `sent_at` preenchido) |
| 400  | `reminder_id` inválido ou canal diferente de `email` |
| 401/403 | Sem sessão / não é admin |
| 409  | Já enviado ou em envio |
| 422  | Cliente sem e-mail |
| 502  | Falha no Resend (`status='failed'`, motivo em `reminders.error`; pode reenviar) |
