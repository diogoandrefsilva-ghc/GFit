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
  fetchRecentLogs,
  fetchTargetsHistory,
} from '@/lib/api'
import { energyOf } from '@/lib/calc'
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
    const [ficha, targets, history, limitations, notes, logs] = await Promise.all([
      fetchAthleteProfile(me.id),
      fetchCurrentTargets(me.id),
      fetchTargetsHistory(me.id),
      fetchLimitations(me.id),
      fetchCoachNotes(me.id, 12),
      fetchRecentLogs(me.id, 60),
    ])
    const lastWeight =
      [...logs].reverse().find((log) => log.weight_kg !== null)?.weight_kg ?? null
    return { ficha, targets, history, limitations, notes, lastWeight }
  })

  if (loading) return <Loading label="A carregar a ficha" />
  if (error || !data) return <p className="error-banner">{error ?? 'Ficha indisponível.'}</p>

  const energy = energyOf(data.ficha, data.lastWeight)

  return (
    <>
      <IdentityCard
        athleteId={me.id}
        ficha={data.ficha}
        lastWeight={data.lastWeight}
        onSaved={reload}
      />

      <TargetsTab
        athleteId={me.id}
        coachId={me.id}
        current={data.targets}
        history={data.history}
        dailyEnergy={energy.daily}
        weightKg={energy.weight}
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
