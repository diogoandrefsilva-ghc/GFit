import { useProfile } from '@/auth/useAuth'
import { Loading } from '@/components/Screen'
import { IdentityCard } from '@/shared/IdentityCard'
import { LimitationsCard } from '@/shared/LimitationsCard'
import { NotesCard } from '@/shared/NotesCard'
import { TargetsTab } from '@/shared/TargetsTab'
import {
  fetchAthleteProfile,
  fetchCoachNotes,
  fetchCurrentTargets,
  fetchLimitations,
  fetchTargetsHistory,
} from '@/lib/api'
import { useQuery } from '@/lib/useQuery'

/**
 * A ficha de quem não tem treinador: os mesmos cartões que o treinador usa num
 * aluno, virados para si próprio. É por aqui que o objectivo, as metas, as
 * limitações e as notas passam a existir para quem treina por sua conta — o
 * aluno sozinho e o treinador, que também é aluno dele próprio.
 *
 * O `created_by` das revisões é o próprio: quem escreveu foi quem as definiu.
 */
export function SelfFicha() {
  const me = useProfile()

  const { data, loading, error, reload } = useQuery(['minha-ficha', me.id], async () => {
    const [ficha, targets, history, limitations, notes] = await Promise.all([
      fetchAthleteProfile(me.id),
      fetchCurrentTargets(me.id),
      fetchTargetsHistory(me.id),
      fetchLimitations(me.id),
      fetchCoachNotes(me.id, 12),
    ])
    return { ficha, targets, history, limitations, notes }
  })

  if (loading) return <Loading label="A carregar a ficha" />
  if (error || !data) return <p className="error-banner">{error ?? 'Ficha indisponível.'}</p>

  return (
    <>
      <IdentityCard athleteId={me.id} ficha={data.ficha} onSaved={reload} />

      <TargetsTab
        athleteId={me.id}
        coachId={me.id}
        current={data.targets}
        history={data.history}
        self
        onChanged={reload}
      />

      <LimitationsCard
        athleteId={me.id}
        coachId={me.id}
        limitations={data.limitations}
        onChanged={reload}
      />

      <NotesCard
        coachId={me.id}
        athleteId={me.id}
        notes={data.notes}
        self
        onSaved={reload}
      />
    </>
  )
}
