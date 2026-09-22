import { useState } from 'react'
import { useAuth } from './useAuth'
import { Logo } from '@/components/Logo'
import { startTrainingAlone } from '@/lib/api'
import { describeError } from '@/lib/supabase'

/**
 * Quem cria conta sem convite escolhe aqui: esperar pelo treinador, ou começar
 * já por sua conta. Escolher o auto-treino não fecha a porta nenhuma — o
 * convite que chegue depois continua a ligar a conta ao treinador, com o que
 * entretanto tiver sido registado.
 */
export function AwaitingInvite() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [busy, setBusy] = useState<'check' | 'alone' | null>(null)
  const [failure, setFailure] = useState<string | null>(null)

  async function check() {
    setBusy('check')
    setFailure(null)
    try {
      await refreshProfile()
    } finally {
      setBusy(null)
    }
  }

  async function alone() {
    if (!profile) return
    setBusy('alone')
    setFailure(null)
    try {
      await startTrainingAlone(profile.id)
      await refreshProfile()
    } catch (caught) {
      setFailure(describeError(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <Logo size={44} />
        <div className="login__intro">
          <h1 className="title">Ainda sem treinador</h1>
          <p className="subtitle">
            A tua conta está criada. Se tens treinador, pede-lhe que te convide
            com <strong>{profile?.email}</strong> e volta a verificar. Se não
            tens, podes começar já — escreves os teus treinos e registas o teu
            dia na mesma.
          </p>
        </div>

        {failure && <p className="error-banner">{failure}</p>}

        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={check}
          disabled={busy !== null}
        >
          {busy === 'check' ? 'A verificar…' : 'Já fui convidado'}
        </button>

        <button
          type="button"
          className="btn btn--ghost btn--block"
          onClick={alone}
          disabled={busy !== null}
        >
          {busy === 'alone' ? 'A preparar…' : 'Treinar por minha conta'}
        </button>

        <button type="button" className="login__switch" onClick={signOut}>
          Sair
        </button>
      </div>
    </div>
  )
}
