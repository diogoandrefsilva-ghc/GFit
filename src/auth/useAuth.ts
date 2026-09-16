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
