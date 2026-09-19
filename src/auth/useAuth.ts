import { useContext } from 'react'
import { AuthContext, type AuthValue } from './context'
import type { Profile } from '@/lib/database.types'

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth tem de estar dentro de <AuthProvider>')
  return value
}

/** O perfil, garantidamente presente dentro das rotas protegidas. */
export function useProfile(): Profile {
  const { profile } = useAuth()
  if (!profile) throw new Error('Sem perfil carregado')
  return profile
}

/**
 * Quem não tem treinador associado responde por si: o plano, as metas e as
 * notas são suas. Vale para o aluno que treina por sua conta e para o
 * treinador, que nunca tem ninguém por cima.
 */
export function useTrainsAlone(): boolean {
  return !useProfile().coach_id
}
