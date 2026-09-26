import { useNavigate } from 'react-router-dom'
import { useAuth, useProfile } from '@/auth/useAuth'
import { Avatar } from '@/components/Avatar'
import { Logo } from '@/components/Logo'
import { useTheme } from '@/lib/theme'
import './appbar.css'

/**
 * Barra da marca, no topo de todos os ecrãs com separadores. O avatar à
 * direita é o atalho para o perfil. No tema Guerreiro a marca é o logótipo
 * inteiro do Guerreiro Personal Trainer, com as linhas verdes e o "personal
 * trainer" — e a barra cresce para ele se ler.
 */
export function AppBar() {
  const profile = useProfile()
  const { isCoach } = useAuth()
  const theme = useTheme()
  const navigate = useNavigate()

  return (
    <header className="appbar">
      <button
        type="button"
        className="appbar__brand"
        onClick={() => navigate(isCoach ? '/inicio' : '/hoje')}
      >
        {theme.id === 'guerreiro' ? (
          <img
            className="appbar__guerreiro"
            src={`${import.meta.env.BASE_URL}guerreiro-logo.png`}
            alt="Guerreiro Personal Trainer"
            decoding="async"
          />
        ) : (
          <>
            <Logo size={26} />
            <span className="appbar__word">GFit</span>
          </>
        )}
      </button>

      <button
        type="button"
        className="appbar__me"
        onClick={() => navigate('/perfil')}
        aria-label="Perfil e definições"
      >
        <Avatar name={profile.full_name} url={profile.avatar_url} size={32} />
      </button>
    </header>
  )
}
