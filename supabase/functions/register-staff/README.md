# register-staff — cadastro de gestão somente por convite

## Como funciona
1. O admin cadastra um convite (e-mail + CPF) no banco. O CPF é guardado só como hash bcrypt.
2. A pessoa abre "Criar conta" e envia e-mail, CPF, nome e senha para a função `register-staff`.
3. A função (servidor) valida o formato, chama `claim_staff_invite` (confere e-mail + CPF com o hash, aplica limite de tentativas e marca o convite como usado) e só então cria o usuário com `app_metadata.role='admin'` (Auth admin API, e-mail já confirmado).
4. Qualquer falha devolve a mesma mensagem genérica (não revela se o e-mail tem convite ou conta). Falhas têm atraso de ~1s.
5. Limite: 5 falhas por e-mail e 20 por IP a cada 15 min (depois → HTTP 429). Obs.: isso permite que um atacante trave temporariamente um e-mail; é o preço do bloqueio por e-mail.
6. Se a criação do usuário falhar (ex.: e-mail já existe), o convite é reaberto.

## Escolha: Edge Function (e não só SQL)
Criar usuário no Auth e definir `app_metadata.role` exige a service role / Admin API; o cliente (anon) nunca pode fazer isso, e um signUp normal não define app_metadata. Por isso a função é necessária. A lógica sensível (hash, limite, reserva atômica) fica em SQL; a função só orquestra. Uma alternativa só-SQL (trigger em `auth.users` que promove quem tiver convite) exigiria que o signUp público já criasse a conta e checar o CPF num trigger sem como devolver erro amigável nem aplicar atraso — e deixaria `signUp` aberto a qualquer um. Não recomendado.

## Passo a passo
1. SQL Editor: rode `supabase_patch_staff_invites.sql` (depois de `supabase_patch_security_booking.sql`).
2. Deploy (sem verificação de JWT, pois o chamador ainda não tem login):
   ```
   supabase login
   supabase link --project-ref nqaegttmdxuoblqixkfq
   supabase functions deploy register-staff --no-verify-jwt
   ```
   Pelo painel: Edge Functions > nova função `register-staff`, cole `index.ts` e desative "Verify JWT". Não há secrets a configurar (`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados).
3. Cadastrar convites (SQL Editor, como dono do projeto):
   ```sql
   select create_staff_invite('maria@exemplo.com', '123.456.789-09', 'Maria Souza');
   ```
   Reemitir para o mesmo e-mail troca o CPF e reabre o convite. Listar: `select email, name, used_at, created_at from staff_invites;`. Revogar: `delete from staff_invites where email = '...';`.
   Um admin logado também pode chamar `supabase.rpc('create_staff_invite', {...})`.
4. Passo futuro sugerido: tela "Convites" na gestão (listar, criar, revogar) usando essa RPC e a tabela (RLS só admin).

## Chamada (front, sem login)
```ts
const { data, error } = await supabase.functions.invoke('register-staff', {
  body: { email, cpf, password, name, gender },   // gender opcional: 'F' | 'M' | 'O' (padrão: o do convite)
});
// sucesso: { ok: true } -> depois fazer signInWithPassword(email, password)
// erro: JSON { error: string }: 400 genérico, 429 muitas tentativas
```
Senha: 8–72 caracteres. CPF pode vir com pontuação.
