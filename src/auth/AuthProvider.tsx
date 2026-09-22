import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { clearCache, setScope } from '@/lib/cache'
import { describeError, supabase } from '@/lib/supabase'
import { AuthContext, type AuthValue } from './context'
import type { Profile } from '@/lib/database.types'


export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const onboarded = useRef<string | null>(null)

  // No primeiro login, getSession() e o evento SIGNED_IN do redirect do OAuth
  // chegavam a pedir o onboarding ao mesmo tempo. Guardar o pedido em curso faz
  // com que o segundo espere pelo primeiro em vez de criar outro perfil.
  const inFlight = useRef<Promise<void> | null>(null)

  const runOnboarding = useCallback(async (userId: string) => {
    // ensure_profile() cria o perfil no primeiro login e consome o convite.
    const { data, error: rpcError } = await supabase.rpc('ensure_profile')
    if (rpcError) {
      setError(describeError(rpcError))
      setProfile(null)
      return
    }

    let current = data as Profile | null

    // Quem se registou antes de ser convidado fica ligado assim que o convite
    // aparecer, sem ter de criar conta outra vez.
    if (current && current.role === 'athlete' && !current.coach_id) {
      const { data: claimed } = await supabase.rpc('claim_pending_invite')
      if (claimed) current = claimed as Profile
    }

    onboarded.current = userId
    setProfile(current)
    setError(null)
  }, [])

  const loadProfile = useCallback(
    (userId: string) => {
      if (inFlight.current) return inFlight.current
      const request = runOnboarding(userId).finally(() => {
        inFlight.current = null
      })
      inFlight.current = request
      return request
    },
    [runOnboarding],
  )

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      // Antes de qualquer ecrã montar: é o que deixa a app abrir já com o que
      // sabia da última vez, em vez de um spinner à espera do servidor.
      setScope(data.session?.user.id ?? null)
      setSession(data.session)
      if (data.session?.user) {
        await loadProfile(data.session.user.id)
      }
      if (active) setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, nextSession) => {
        if (!active) return
        setScope(nextSession?.user.id ?? null)
        setSession(nextSession)

        if (!nextSession?.user) {
          onboarded.current = null
          setProfile(null)
          return
        }
        if (event === 'SIGNED_IN' && onboarded.current !== nextSession.user.id) {
          void loadProfile(nextSession.user.id)
        }
      },
    )

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user.id)
  }, [session, loadProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    // Num telemóvel partilhado, quem entrar a seguir não pode apanhar os dados
    // de quem saiu.
    clearCache()
    setScope(null)
    onboarded.current = null
    setProfile(null)
    setSession(null)
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      loading,
      error,
      isCoach: profile?.role === 'coach',
      isAdmin: profile?.is_admin ?? false,
      // Sem treinador há dois caminhos: esperar pelo convite, ou treinar por
      // sua conta. O `status` é que os separa — 'pending' é quem ainda está à
      // espera, e quem escolhe o auto-treino fica 'active' sem treinador.
      awaitingInvite:
        profile?.role === 'athlete' &&
        !profile.coach_id &&
        profile.status === 'pending',
      refreshProfile,
      signOut,
    }),
    [session, profile, loading, error, refreshProfile, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
