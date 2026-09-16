/**
 * Ligação ao Supabase.
 *
 * A URL e a chave publicável são credenciais de cliente: viajam no bundle e
 * são visíveis a quem abrir as ferramentas do browser, de qualquer forma. Quem
 * protege os dados é o RLS, não estas duas linhas. Por isso ficam aqui como
 * valor por omissão, e a app compila e corre sem ser preciso configurar
 * variáveis no GitHub ou em lado nenhum.
 *
 * Um `.env` continua a poder sobrepor-se, para apontar a app a outro projeto
 * (uma branch do Supabase, por exemplo).
 */
const DEFAULT_URL = 'https://gjweqwfbnkgnibhajldc.supabase.co'
const DEFAULT_PUBLISHABLE_KEY = 'sb_publishable_6d9-ZMJhBfu4Wtg2HEfwww_YU9dtbjM'

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_URL

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || DEFAULT_PUBLISHABLE_KEY
