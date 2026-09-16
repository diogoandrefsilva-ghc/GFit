import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProfile } from '@/auth/useAuth'
import { Avatar } from '@/components/Avatar'
import { Empty, Loading, ScreenHeader } from '@/components/Screen'
import {
  createInvite,
  fetchAthleteSummaries,
  fetchInvites,
  revokeInvite,
  type AthleteSummary,
} from '@/lib/api'
import { describeError } from '@/lib/supabase'
import { daysBetween, isoDate, num, plural, relativeDate, signed } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import './athletes.css'

type Filter = 'attention' | 'all' | 'paused'

/** Um aluno precisa de atenção quando há feedback por ler, o plano está a
 *  acabar, faltam treinos ou desapareceu há dias. */
function needsAttention(summary: AthleteSummary): string | null {
  if (summary.unreadFeedback) return 'Feedback por ler'
  if (!summary.plan) return 'Sem plano publicado'

  const endsIn =
    summary.plan.num_weeks - summary.week
  if (endsIn <= 0) return 'Plano a acabar'

  const missed = summary.sessionsPlanned - summary.sessionsDone
  const weekDay = new Date().getDay() // 0 domingo
  if (weekDay >= 5 && missed > 1) return `${missed} treinos em falta`

  if (summary.lastSeen && daysBetween(summary.lastSeen, isoDate()) >= 4) {
    return `Sem registos há ${daysBetween(summary.lastSeen, isoDate())} dias`
  }
  if (!summary.lastSeen) return 'Ainda sem registos'
  return null
}

export function Athletes() {
  const profile = useProfile()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('attention')
  const [inviting, setInviting] = useState(false)

  const { data, loading, error, reload } = useQuery(async () => {
    const [summaries, invites] = await Promise.all([
      fetchAthleteSummaries(profile.id),
      fetchInvites(profile.id),
    ])
    return { summaries, invites }
  }, [profile.id])

  const flagged = useMemo(() => {
    if (!data) return new Map<string, string>()
    const map = new Map<string, string>()
    for (const summary of data.summaries) {
      const reason = needsAttention(summary)
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
    if (filter === 'attention') return flagged.has(summary.profile.id)
    if (filter === 'paused') return summary.profile.status !== 'active'
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
        action={
          <button
            type="button"
            className="today__me"
            onClick={() => navigate('/perfil')}
            aria-label="Perfil e definições"
          >
            <Avatar name={profile.full_name} url={profile.avatar_url} size={38} />
          </button>
        }
      />

      <div className="row row--wrap athletes__filters">
        {(
          [
            ['attention', `A precisar (${flagged.size})`],
            ['all', `Todos (${summaries.length})`],
            ['paused', 'Em pausa'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`chip ${filter === key ? 'chip--on' : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="chip chip--accent"
          onClick={() => setInviting((value) => !value)}
        >
          + Aluno
        </button>
      </div>

      {inviting && (
        <InviteForm
          coachId={profile.id}
          onDone={() => {
            setInviting(false)
            reload()
          }}
        />
      )}

      {pendingInvites.length > 0 && (
        <section className="card card--flat">
          <span className="eyebrow">Convites por aceitar</span>
          <ul className="invites">
            {pendingInvites.map((invite) => (
              <li key={invite.id} className="invite">
                <span className="invite__email">{invite.email}</span>
                <span className="muted">{relativeDate(invite.created_at.slice(0, 10))}</span>
                <button
                  type="button"
                  className="btn btn--sm btn--quiet"
                  onClick={async () => {
                    await revokeInvite(invite.id)
                    reload()
                  }}
                >
                  Anular
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {visible.length === 0 ? (
        <Empty
          title={
            filter === 'attention' ? 'Está tudo em dia' : 'Sem alunos nesta vista'
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

function InviteForm({
  coachId,
  onDone,
}: {
  coachId: string
  onDone: () => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  return (
    <section className="card">
      <span className="eyebrow">Convidar aluno</span>
      <p className="subtitle">
        O aluno entra com este email — Google ou palavra-passe — e fica logo
        ligado a ti.
      </p>

      <label className="field">
        <span className="field__label">Email</span>
        <input
          className="input"
          type="email"
          value={email}
          inputMode="email"
          placeholder="aluno@exemplo.pt"
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field__label">Nome (opcional)</span>
        <input
          className="input"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      {failure && <p className="error-banner">{failure}</p>}

      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={busy || !email.includes('@')}
        onClick={async () => {
          setBusy(true)
          setFailure(null)
          try {
            await createInvite(coachId, email, name.trim() || null)
            onDone()
          } catch (caught) {
            const message = describeError(caught)
            setFailure(
              /duplicate key|invites_pending_email_uq/i.test(message)
                ? 'Já existe um convite pendente para este email.'
                : message,
            )
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'A convidar…' : 'Criar convite'}
      </button>
    </section>
  )
}
