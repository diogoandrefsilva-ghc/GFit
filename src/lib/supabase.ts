import { createClient } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'
import type { Database } from './database.types'

/**
 * O projeto Supabase é partilhado por várias apps pessoais, uma schema cada.
 * A GFit vive em `gfit`, que tem de estar exposta em Settings → API →
 * Exposed schemas.
 */
export const supabase = createClient<Database, 'gfit'>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    db: { schema: 'gfit' },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  },
)

/** URL a que o OAuth deve voltar, respeitando o base path do GitHub Pages. */
export function redirectUrl() {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}

/**
 * Traduz os erros mais prováveis para algo que se perceba no ecrã.
 */
export function describeError(error: unknown): string {
  if (!error) return 'Erro desconhecido.'
  const message = error instanceof Error ? error.message : String(error)

  if (/schema must be one of|does not exist/i.test(message)) {
    return 'A schema "gfit" ainda não está exposta na API do Supabase. Settings → API → Exposed schemas.'
  }
  if (/Invalid login credentials/i.test(message)) {
    return 'Email ou palavra-passe errados.'
  }
  if (/Email not confirmed/i.test(message)) {
    return 'Confirma o email antes de entrar.'
  }
  if (/User already registered/i.test(message)) {
    return 'Já existe conta com este email. Entra em vez de criar.'
  }
  if (/Password should be at least/i.test(message)) {
    return 'A palavra-passe precisa de pelo menos 6 caracteres.'
  }
  if (/row-level security|violates row-level/i.test(message)) {
    return 'Sem permissões para esta operação.'
  }
  if (/Failed to fetch|NetworkError/i.test(message)) {
    return 'Sem ligação. Tenta outra vez.'
  }
  return message
}
