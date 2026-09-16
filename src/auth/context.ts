import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '@/lib/database.types'

export interface AuthValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string | null
  isCoach: boolean
  /** Perfil criado mas ainda sem treinador associado. */
  awaitingInvite: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)
