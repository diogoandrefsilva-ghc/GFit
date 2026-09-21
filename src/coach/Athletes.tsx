import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useProfile } from '@/auth/useAuth'
import { Avatar } from '@/components/Avatar'
import { Empty, Loading, ScreenHeader } from '@/components/Screen'
import { attentionReason, fetchAthleteSummaries, fetchInvites } from '@/lib/api'
import { num, plural, relativeDate, signed } from '@/lib/format'
import { ATHLETE_VIEWS, type AthleteView } from '@/lib/routes'
import { useQuery } from '@/lib/useQuery'
import './athletes.css'

export function Athletes() {
  const profile = useProfile()

  // A vista vive na barra de endereço e não em estado local: é assim que os
  // cartões do Início podem trazer o treinador já à lista certa, e que voltar
  // de uma ficha devolve a lista onde ela estava.
  const [params, setParams] = useSearchParams()
  const asked = params.get('ver')
  const filter: AthleteView = ATHLETE_VIEWS.includes(asked as AthleteView)
    ? (asked as AthleteView)
    : 'atencao'

  const { data, loading, error } = useQuery(['alunos', profile.id], async () => {
    const [summaries, invites] = await Promise.all([
      fetchAthleteSummaries(profile.id),
      fetchInvites(profile.id),
    ])
    return { summaries, invites }
  })

  const flagged = useMemo(() => {
    if (!data) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const summary of data.summaries) {
      const reason = attentionReason(summary)
      if (reason) map.set(summary.profile.id, reason)
    }
    return map
  }, [data])

  if (loading) return <Loading label="A carregar alunos" />
  if (error) {
    return (
      <div className="screen">
        <p className="error-banner">{error}</p>
      </div>
    )
  }

  const { summaries, invites } = data!
  const pendingInvites = invites.filter((invite) => invite.status === 'pending')

  const visible = summaries.filter((summary) => {
    if (filter === 'atencao') return flagged.has(summary.profile.id)
    if (filter === 'pausa') return summary.profile.status !== 'active'
    return true
  })

  const active = summaries.filter((s) => s.profile.status === 'active').length

  return (
    <div className="screen">
      <ScreenHeader
        title="Alunos"
        subtitle={`${plural(active, 'aluno activo', 'alunos activos')} · ${flagged.size} ${
          flagged.size === 1 ? 'precisa' : 'precisam'
        } de ti`}
      />

      <div className="row row--wrap athletes__filters">
        {(
          [
            ['atencao', `A precisar (${flagged.size})`],
            ['todos', `Todos (${summaries.length})`],
            ['pausa', 'Em pausa'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`chip ${filter === key ? 'chip--on' : ''}`}
            onClick={() => setParams({ ver: key }, { replace: true })}
          >
            {label}
          </button>
        ))}
        <Link className="chip chip--accent" to="/perfil">
          + Aluno
        </Link>
      </div>

      {pendingInvites.length > 0 && (
        <p className="athletes__pending muted">
          {plural(pendingInvites.length, 'convite', 'convites')} por aceitar ·{' '}
          <Link to="/perfil">ver</Link>
        </p>
      )}

      {visible.length === 0 ? (
        <Empty
          title={
            filter === 'atencao' ? 'Está tudo em dia' : 'Sem alunos nesta vista'
          }
          hint={
            summaries.length === 0
              ? 'Convida o primeiro aluno com o botão + Aluno.'
              : undefined
          }
        />
      ) : (
        <ul className="athletes">
          {visible.map((summary) => {
            const reason = flagged.get(summary.profile.id)
            return (
              <li key={summary.profile.id}>
                <Link className="athlete" to={`/alunos/${summary.profile.id}`}>
                  <Avatar
                    name={summary.profile.full_name}
                    url={summary.profile.avatar_url}
                    size={44}
                  />
                  <div className="athlete__text">
                    <span className="athlete__name">
                      {summary.profile.full_name ?? summary.profile.email}
                    </span>
                    <span className="athlete__meta">
                      {summary.plan
                        ? `Semana ${summary.week}/${summary.plan.num_weeks}`
                        : summary.selfPlans > 0
                          ? 'Sem plano · treina por sua conta'
                          : 'Sem plano'}
                      {summary.lastLog?.weight_kg
                        ? ` · ${num(summary.lastLog.weight_kg, 1)} kg`
                        : ''}
                      {summary.weightChange !== null
                        ? ` (${signed(summary.weightChange)})`
                        : ''}
                    </span>
                    <span className="athlete__state">
                      {reason ? (
                        <em className="athlete__flag">{reason}</em>
                      ) : (
                        <em className="athlete__ok">
                          {summary.sessionsDone}/{summary.sessionsPlanned} treinos
                        </em>
                      )}
                    </span>
                  </div>
                  <span className="athlete__when muted">
                    {summary.lastSeen ? relativeDate(summary.lastSeen) : '—'}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
