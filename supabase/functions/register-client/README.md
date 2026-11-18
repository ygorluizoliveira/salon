# register-client — cadastro de cliente somente por convite

## Como funciona
1. O gestor gera um convite (RPC `create_client_invite`) e recebe um **token** (32 caracteres hex) mostrado **uma única vez** (no banco fica só o hash). Envia o código/link ao cliente manualmente (WhatsApp etc.). Validade: **15 minutos**, uso único. O convite não leva dados: é só um link (`/cliente?convite=<token>`). Requer também `supabase_patch_client_invites_link.sql` (rodar depois do patch de convites).
2. O cliente informa token + e-mail + senha (+ nome e telefone (obrigatórios, se o convite não os trouxer) + endereço opcional) na função `register-client`.
3. O servidor reserva o convite (não usado e não expirado), cria o usuário pela Admin API (e-mail confirmado, `user_metadata {is_client,name,phone,address}`) e:
   - convite com `client_id` → apenas vincula `clients.user_id` ao cliente já cadastrado (sem duplicar);
   - convite sem `client_id` → cria a linha em `clients`.
   Se algo falhar, o usuário recém-criado é apagado e o convite reaberto (sem conta órfã).
4. Erros de token são genéricos; atraso ~1s; limite de 10 falhas por IP a cada 15 min (HTTP 429). O token tem 128 bits, então força bruta é inviável.
5. O convite do e-mail: se o gestor informou e-mail no convite, ele é obrigatório/forçado.

## Passo a passo
1. SQL Editor: rode `supabase_patch_client_invites.sql` (depois de `supabase_patch_security_booking.sql`).
   Ele também **remove o trigger de auto-criação de clients** e a policy que deixava um logado inserir a própria linha em `clients`.
2. Deploy: `supabase functions deploy register-client --no-verify-jwt` (sem secrets). Painel: nova função, cole `index.ts`, desative "Verify JWT".
3. **Desabilite o cadastro público no Supabase** (recomendado): Dashboard > Authentication > Sign In / Providers (ou Settings) > desmarque **"Allow new users to sign up"**. A Admin API (`createUser`) usada pelas funções `register-client`/`register-staff` continua funcionando com o signup desligado; só o endpoint público `auth.signUp` passa a ser bloqueado. Mesmo que fique ligado, um signUp público não ganha acesso: não vira cliente nem admin e as RLS não liberam nada sem linha em `clients`.
4. Criar convite (SQL Editor ou, logado como admin, `supabase.rpc`):
   ```sql
   -- cliente novo
   select * from create_client_invite();  -- sem parâmetros
   -- ligado a um cliente já cadastrado (e opcionalmente e-mail)
   select * from create_client_invite('Maria Souza', '(11) 99999-0000', 'maria@x.com', '<uuid do cliente>');
   ```
   Resultado: `invite_id`, `token`, `expires_at`. Link sugerido: `https://SEU_APP/cliente?convite=<token>` (rota/tela é do front).
   Revogar: `update client_invites set used_at = now() where id = '...';`. Listar: `select id, name, client_id, expires_at, used_at from client_invites order by created_at desc;`.
   Novo convite para o mesmo cliente invalida os pendentes anteriores.

## Chamada (front, sem login)
```ts
const { data, error } = await supabase.functions.invoke('register-client', {
  body: { token, email, password, name?, phone?, address? },
});
// sucesso { ok: true } -> signInWithPassword(email, password)
// erro: JSON { error: string }: 400 (convite inválido/expirado/dados), 429 (muitas tentativas), 500
```
O front deve remover o `auth.signUp` + `insert` em `clients` do `ClientAuthContext` (o insert agora é bloqueado pela RLS).

## Código curto (ex.: ROSICOIFFEUR-482)
Rodar também supabase_patch_client_invite_code.sql e fazer redeploy. create_client_invite passa a devolver {invite_id, token, code, expires_at}. O cadastro aceita 	oken (link) ou code (digitação manual). O código tem só 1000 combinações: expira em 15 min, uso único, 10 falhas/IP e 10 falhas globais/15 min (ao estourar, os códigos pendentes são desativados; o link com token continua valendo). Risco residual ~1% por convite ativo; prefira o link.
