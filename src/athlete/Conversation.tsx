import { Navigate } from 'react-router-dom'
import { useProfile } from '@/auth/useAuth'
import { ScreenHeader } from '@/components/Screen'
import { Thread } from '@/shared/Thread'
import { fetchCoach } from '@/lib/api'
import { useQuery } from '@/lib/useQuery'

/**
 * A conversa do aluno com o treinador. Chega-se cá pelo cartão do Hoje — não
 * tem separador seu, porque não é coisa de todos os dias como o registo.
 */
export function Conversation() {
  const profile = useProfile()
  const coachId = profile.coach_id

  const { data: coach } = useQuery(['treinador', coachId], () =>
    coachId ? fetchCoach(coachId) : Promise.resolve(null),
  )

  // Quem treina por sua conta não tem com quem conversar: as notas dele vivem
  // na ficha.
  if (!coachId) return <Navigate to="/hoje" replace />

  const firstName = coach?.full_name?.split(' ')[0] ?? 'o treinador'

  return (
    <div className="screen">
      <ScreenHeader
        back
        eyebrow="Conversa"
        title={coach?.full_name ?? 'O teu treinador'}
        subtitle="Dúvidas, como correu o treino, o que mudou. Ele vê quando abrir a app."
      />
      <Thread
        athleteId={profile.id}
        coachId={coachId}
        meId={profile.id}
        otherName={firstName}
      />
    </div>
  )
}
