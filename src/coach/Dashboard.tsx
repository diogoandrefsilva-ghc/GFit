import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useProfile } from '@/auth/useAuth'
import { Avatar } from '@/components/Avatar'
import { Loading, ScreenHeader, Stat } from '@/components/Screen'
import { attentionReason, fetchAthleteSummaries, type AthleteSummary } from '@/lib/api'
import { weightTone } from '@/lib/calc'
import { isoDate, longDate, num, plural, relativeDate, shortDate, signed } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import './dashboard.css'

/**
 * O que o treinador precisa de saber ao abrir a app: quem está a precisar
 * dele, como vai a semana, e o que tem por responder.
 */
export function Dashboard() {
  const profile = useProfile()

  const { data, loading, error } = useQuery(['inicio-treinador', profile.id], () =>
    fetchAthleteSummaries(profile.id),
  )

  const view = useMemo(() => {
    const summaries = data ?? []
    const flagged: { summary: AthleteSummary; reason: string }[] = []

    for (const summary of summaries) {
      const reason = attentionReason(summary)
      if (reason) flagged.push({ summary, reason })
    }

    const active = summaries.filter((s) => s.profile.status === 'active')
    const done = summaries.reduce((sum, s) => sum + s.sessionsDone, 0)
    const planned = summaries.reduce((sum, s) => sum + s.sessionsPlanned, 0)
    const unread = summaries.filter((s) => s.unreadFeedback)
    const ending = summaries.filter(
      (s) => s.plan && s.plan.num_weeks - s.week <= 1,
    )
    const loggedToday = summaries.filter((s) => s.lastSeen === isoDate())

    return { summaries, flagged, active, done, planned, unread, ending, loggedToday }
  }, [data])

  if (loading) return <Loading label="A carregar" />
  if (error) {
    return (
      <div className="screen">
        <p className="error-banner">{error}</p>
      </div>
    )
  }

  const firstName = (profile.full_name ?? '').split(' ')[0] || 'Treinador'

  return (
    <div className="screen">
      <ScreenHeader eyebrow={longDate()} title={`Olá, ${firstName}`} />

      {view.summaries.length === 0 ? (
        <section className="card">
          <span className="eyebrow">Primeiro passo</span>
          <p className="subtitle">
            Ainda não tens alunos. Convida o primeiro no separador Perfil e ele
            aparece aqui assim que entrar.
          </p>
          <Link className="btn btn--primary btn--block" to="/perfil">
            Convidar aluno
          </Link>
        </section>
      ) : (
        <>
          <div className="row">
            <Stat
              label="Alunos"
              value={view.active.length}
              hint={
                view.summaries.length !== view.active.length
                  ? `${view.summaries.length - view.active.length} em pausa`
                  : 'activos'
              }
            />
            <Stat
              label="A precisar"
              value={view.flagged.length}
              tone={view.flagged.length > 0 ? 'warn' : 'good'}
              hint={view.flagged.length === 0 ? 'tudo em dia' : 'de ti'}
            />
          </div>

          <div className="row">
            <Stat
              label="Treinos"
              value={`${view.done}/${view.planned || '—'}`}
              hint="esta semana"
              tone={view.planned > 0 && view.done >= view.planned ? 'good' : 'default'}
            />
            <Stat
              label="Registaram hoje"
              value={`${view.loggedToday.length}/${view.active.length}`}
              hint="peso, sono, passos"
            />
          </div>

          {/* ── quem precisa de ti ─────────────────────── */}
          {view.flagged.length > 0 && (
            <section className="card">
              <div className="card__head">
                <span className="eyebrow">A precisar de ti</span>
                <Link className="dash__more" to="/alunos">
                  ver todos
                </Link>
              </div>
              <ul className="dash__list">
                {view.flagged.slice(0, 5).map(({ summary, reason }) => (
                  <li key={summary.profile.id}>
                    <Link className="dash__row" to={`/alunos/${summary.profile.id}`}>
                      <Avatar
                        name={summary.profile.full_name}
                        url={summary.profile.avatar_url}
                        size={38}
                      />
                      <span className="dash__row-text">
                        <strong>{summary.profile.full_name ?? summary.profile.email}</strong>
                        <em className="dash__reason">{reason}</em>
                      </span>
                      <span className="dash__when">
                        {summary.lastSeen ? relativeDate(summary.lastSeen) : '—'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── feedback por responder ─────────────────── */}
          {view.unread.length > 0 && (
            <section className="card card--accent">
              <span className="eyebrow">
                {plural(view.unread.length, 'feedback por ler', 'feedbacks por ler')}
              </span>
              <ul className="dash__list">
                {view.unread.map((summary) => (
                  <li key={summary.profile.id}>
                    <Link className="dash__row" to={`/alunos/${summary.profile.id}`}>
                      <Avatar
                        name={summary.profile.full_name}
                        url={summary.profile.avatar_url}
                        size={34}
                      />
                      <span className="dash__row-text">
                        <strong>{summary.profile.full_name}</strong>
                        <em>
                          semana {summary.unreadFeedback?.week_number}
                          {summary.unreadFeedback?.motivation
                            ? ` · motivação ${summary.unreadFeedback.motivation}/10`
                            : ''}
                        </em>
                      </span>
                      <span className="dash__go">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── planos a acabar ────────────────────────── */}
          {view.ending.length > 0 && (
            <section className="card">
              <span className="eyebrow">Planos a acabar</span>
              <ul className="dash__list">
                {view.ending.map((summary) => (
                  <li key={summary.profile.id}>
                    <Link className="dash__row" to={`/alunos/${summary.profile.id}`}>
                      <span className="dash__row-text">
                        <strong>{summary.profile.full_name}</strong>
                        <em>
                          {summary.plan?.name} · semana {summary.week} de{' '}
                          {summary.plan?.num_weeks}
                        </em>
                      </span>
                      <span className="chip chip--warn">renovar</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ── movimento de peso ──────────────────────── */}
          <section className="card card--flat">
            <div className="card__head">
              <span className="eyebrow">Peso, últimos 60 dias</span>
              <Link className="dash__more" to="/alunos">
                alunos
              </Link>
            </div>
            <ul className="dash__weights">
              {view.summaries
                .filter((summary) => summary.weightChange !== null)
                .sort(
                  (a, b) =>
                    Math.abs(b.weightChange ?? 0) - Math.abs(a.weightChange ?? 0),
                )
                .slice(0, 6)
                .map((summary) => (
                  <li key={summary.profile.id}>
                    <span className="dash__weight-name">
                      {summary.profile.full_name}
                    </span>
                    <span className="dash__weight-now">
                      {summary.lastLog?.weight_kg
                        ? `${num(summary.lastLog.weight_kg, 1)} kg`
                        : '—'}
                    </span>
                    <span
                      className={`dash__weight-diff ${
                        weightTone(summary.weightChange, summary.weightDirection) ===
                        'good'
                          ? 'is-good'
                          : ''
                      }`}
                    >
                      {signed(summary.weightChange)}
                    </span>
                  </li>
                ))}
              {view.summaries.every((summary) => summary.weightChange === null) && (
                <li className="muted dash__empty">
                  Ainda sem pesagens que cheguem para comparar.
                </li>
              )}
            </ul>
          </section>
        </>
      )}

      <p className="dash__foot muted">
        Semana de {shortDate(isoDate())} · toca num aluno para abrir a ficha
      </p>
    </div>
  )
}
