import { useNavigate } from 'react-router-dom'
import { useAuth, useProfile } from '@/auth/useAuth'
import { Avatar } from '@/components/Avatar'
import './appbar.css'

/**
 * Barra da marca, no topo de todos os ecrãs com separadores. O avatar à
 * direita é o atalho para o perfil.
 */
export function AppBar() {
  const profile = useProfile()
  const { isCoach } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="appbar">
      <button
        type="button"
        className="appbar__brand"
        onClick={() => navigate(isCoach ? '/inicio' : '/hoje')}
      >
        <svg width="26" height="26" viewBox="0 0 48 48" aria-hidden="true">
          <rect width="48" height="48" rx="12" fill="#16150F" />
          <rect x="10" y="21.5" width="28" height="5" rx="2.5" fill="#F4F1EC" />
          <rect x="7" y="17" width="6" height="14" rx="2.5" fill="#FF4A1C" />
          <rect x="35" y="17" width="6" height="14" rx="2.5" fill="#FF4A1C" />
        </svg>
        <span className="appbar__word">GFit</span>
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
