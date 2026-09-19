import { useState, type FormEvent } from 'react'
import { describeError, redirectUrl, supabase } from '@/lib/supabase'
import { Logo } from '@/components/Logo'
import './login.css'

type Mode = 'signin' | 'signup'

export function Login() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function signInWithGoogle() {
    setBusy(true)
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: redirectUrl() },
    })
    if (oauthError) {
      setError(describeError(oauthError))
      setBusy(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setNotice(null)

    try {
      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (signInError) throw signInError
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() || null },
            emailRedirectTo: redirectUrl(),
          },
        })
        if (signUpError) throw signUpError
        if (!data.session) {
          setNotice('Conta criada. Confirma o email e depois entra.')
          setMode('signin')
        }
      }
    } catch (caught) {
      setError(describeError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <div className="login__card">
        <div className="login__intro">
          {/* O logótipo completo faz de título: o `alt` da imagem é o nome. */}
          <h1 className="title login__logo">
            <Logo variant="full" size={132} />
          </h1>
          <p className="subtitle">
            Treinos, medidas, dieta e feedback, entre treinador e aluno.
          </p>
        </div>

        <button
          type="button"
          className="btn btn--ghost btn--block login__google"
          onClick={signInWithGoogle}
          disabled={busy}
        >
          <GoogleMark />
          Continuar com Google
        </button>

        <div className="login__divider">
          <span>ou</span>
        </div>

        <form className="login__form" onSubmit={submit}>
          {mode === 'signup' && (
            <label className="field">
              <span className="field__label">Nome</span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                placeholder="Como te chamas"
              />
            </label>
          )}

          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              inputMode="email"
              placeholder="tu@exemplo.pt"
            />
          </label>

          <label className="field">
            <span className="field__label">Palavra-passe</span>
            <input
              className="input"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
            />
          </label>

          {error && <p className="error-banner">{error}</p>}
          {notice && <p className="login__notice">{notice}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? 'Um momento…' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <button
          type="button"
          className="login__switch"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin')
            setError(null)
            setNotice(null)
          }}
        >
          {mode === 'signin'
            ? 'Ainda não tenho conta'
            : 'Já tenho conta, quero entrar'}
        </button>
      </div>

      <p className="login__foot">
        O acesso de aluno é por convite do treinador.
      </p>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.3 6.6v5.5h7c4.1-3.8 6.6-9.4 6.6-16.1z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.8 0 10.7-1.9 14.3-5.2l-7-5.5c-1.9 1.3-4.4 2.1-7.3 2.1-5.6 0-10.4-3.8-12.1-8.9H4.7v5.6C8.3 41.4 15.6 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.9 28.5c-.4-1.3-.7-2.6-.7-4s.2-2.7.7-4v-5.6H4.7A22 22 0 0 0 2.4 24.5c0 3.5.8 6.9 2.3 9.6l7.2-5.6z"
      />
      <path
        fill="#EA4335"
        d="M24 11.4c3.2 0 6 1.1 8.2 3.2l6.2-6.2C34.7 5 29.8 3 24 3 15.6 3 8.3 7.6 4.7 14.9l7.2 5.6c1.7-5.1 6.5-9.1 12.1-9.1z"
      />
    </svg>
  )
}
