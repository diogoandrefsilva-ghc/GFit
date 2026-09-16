import { useState } from 'react'
import { useAuth } from './useAuth'
import { Logo } from '@/components/Logo'

/**
 * Quem cria conta sem convite fica aqui. O perfil já existe, só falta o
 * treinador criar o convite com este email — daí o botão de voltar a verificar.
 */
export function AwaitingInvite() {
  const { profile, refreshProfile, signOut } = useAuth()
  const [checking, setChecking] = useState(false)

  async function check() {
    setChecking(true)
    await refreshProfile()
    setChecking(false)
  }

  return (
    <div className="login">
      <div className="login__card">
        <Logo size={44} />
        <div className="login__intro">
          <h1 className="title">Falta o convite</h1>
          <p className="subtitle">
            A tua conta está criada, mas ainda não está ligada a nenhum treinador.
            Pede-lhe que te convide com <strong>{profile?.email}</strong> e volta
            a verificar.
          </p>
        </div>

        <button
          type="button"
          className="btn btn--primary btn--block"
          onClick={check}
          disabled={checking}
        >
          {checking ? 'A verificar…' : 'Já fui convidado'}
        </button>

        <button type="button" className="login__switch" onClick={signOut}>
          Sair
        </button>
      </div>
    </div>
  )
}
