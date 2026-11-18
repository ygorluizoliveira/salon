export const NETWORK_TIMEOUT_MS = 15000;

export function withTimeout<T>(promise: PromiseLike<T>, ms = NETWORK_TIMEOUT_MS): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
    Promise.resolve(promise).then(
      v => { clearTimeout(timer); resolve(v); },
      e => { clearTimeout(timer); reject(e); },
    );
  });
}

/** Translates database/PostgREST errors to Portuguese; never exposes raw DB text. */
export function translateDbError(err?: { message?: string; code?: string } | null): string {
  const msg = (err?.message ?? '').toLowerCase();
  if (err?.code === '23P01' || msg.includes('no_overlap') || msg.includes('exclusion constraint') || msg.includes('conflicting key')) {
    return 'Esse horário acabou de ser ocupado. Escolha outro.';
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('timeout')) {
    return 'Erro de conexão. Verifique sua internet e tente novamente.';
  }
  if (err?.code === '42501' || msg.includes('row-level security') || msg.includes('permission denied')) {
    return 'Você não tem permissão para realizar esta ação.';
  }
  if (err?.code === '23505' || msg.includes('duplicate key')) return 'Este registro já existe.';
  if (err?.code === '23503') return 'Registro relacionado não encontrado.';
  return 'Não foi possível concluir a operação. Tente novamente.';
}

/** Translates Supabase/network auth errors to Portuguese. */
export function translateAuthError(raw?: string | null): string {
  const msg = (raw ?? '').toLowerCase();
  if (!msg) return 'Erro inesperado. Tente novamente.';
  if (msg === 'timeout') return 'Tempo de conexão esgotado. Verifique sua internet e tente novamente.';
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
    return 'Erro de conexão. Verifique sua internet e tente novamente.';
  }
  if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (msg.includes('email not confirmed')) return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'Este e-mail já está cadastrado.';
  }
  if (msg.includes('password should be at least')) return 'A senha deve ter pelo menos 6 caracteres.';
  if (msg.includes('unable to validate email') || msg.includes('invalid email') || msg.includes('is invalid')) {
    return 'E-mail inválido.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('security purposes')) {
    return 'Muitas tentativas. Aguarde um instante e tente novamente.';
  }
  if (msg.includes('signup') && msg.includes('disabled')) return 'Cadastro desativado no momento.';
  if (msg.includes('same password')) return 'A nova senha deve ser diferente da atual.';
  if (msg.includes('database error')) return 'Erro ao criar a conta. Tente novamente em instantes.';
  return raw as string;
}
