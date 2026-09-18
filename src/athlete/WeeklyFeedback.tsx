import { useEffect, useState } from 'react'
import { useProfile } from '@/auth/useAuth'
import { Loading, ScreenHeader, Stat } from '@/components/Screen'
import { Scale } from '@/components/Scale'
import {
  fetchActivePlan,
  fetchFeedbackHistory,
  fetchRecentLogs,
  fetchWeekSessions,
  fetchWeeklyFeedback,
  saveWeeklyFeedback,
} from '@/lib/api'
import { average, weekOfPlan } from '@/lib/calc'
import { addDays, hoursLabel, isoDate, num, shortDate, weekStart } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import type { WeeklyFeedback } from '@/lib/database.types'
import './weekly-feedback.css'

/** As perguntas da folha "Feedback semanal", tal como o Treinador as faz. */
const QUESTIONS = [
  {
    key: 'overall' as const,
    label: 'O que achaste da semana em geral?',
    hint: 'progressão ou regressão',
  },
  {
    key: 'went_well' as const,
    label: 'O que correu bem?',
    hint: 'dieta, treino, descanso',
  },
  {
    key: 'difficulties' as const,
    label: 'Que dificuldades sentiste?',
    hint: 'dieta, treino, descanso',
  },
  {
    key: 'next_week' as const,
    label: 'Qual a tua perspetiva para a próxima semana?',
  },
]

export function WeeklyFeedbackScreen() {
  const profile = useProfile()
  const week = weekStart()

  const { data, loading, error, reload } = useQuery(['semana', profile.id, week], async () => {
    const [existing, logs, plan, history] = await Promise.all([
      fetchWeeklyFeedback(profile.id, week),
      fetchRecentLogs(profile.id, 7),
      fetchActivePlan(profile.id),
      fetchFeedbackHistory(profile.id),
    ])

    const weekNumber = plan ? weekOfPlan(plan.plan.start_date, isoDate()) : 1
    const sessions = plan
      ? await fetchWeekSessions(profile.id, plan.plan.id, weekNumber)
      : []

    return { existing, logs, plan, sessions, weekNumber, history }
  })

  const [draft, setDraft] = useState<Partial<WeeklyFeedback>>({})
  const [saving, setSaving] = useState(false)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (data?.existing) {
      setDraft(data.existing)
      setSent(data.existing.status === 'sent')
    }
  }, [data?.existing])

  if (loading) return <Loading label="A carregar a semana" />
  if (error) {
    return (
      <div className="screen">
        <p className="error-banner">{error}</p>
      </div>
    )
  }

  const { logs, plan, sessions, weekNumber, history } = data!

  const done = sessions.filter((session) => session.status === 'done').length
  const planned = plan?.days.length ?? 0
  const sleep = average(logs.map((log) => log.sleep_hours))
  const energy = average(logs.map((log) => log.energy))
  const hunger = average(logs.map((log) => log.hunger))
  const stress = average(logs.map((log) => log.stress))

  async function persist(status: 'draft' | 'sent') {
    setSaving(true)
    try {
      await saveWeeklyFeedback(profile.id, week, {
        ...draft,
        plan_id: plan?.plan.id ?? null,
        week_number: weekNumber,
        trainings_done: done,
        trainings_planned: planned,
        status,
        sent_at: status === 'sent' ? new Date().toISOString() : null,
      })
      if (status === 'sent') setSent(true)
      reload()
    } finally {
      setSaving(false)
    }
  }

  const replied = data?.existing?.coach_reply

  return (
    <div className="screen">
      <ScreenHeader
        eyebrow={`Semana ${weekNumber}`}
        title="Feedback da semana"
        subtitle={`${shortDate(week)} a ${shortDate(addDays(week, 6))}`}
      />

      {replied && (
        <section className="card card--good">
          <span className="eyebrow">Resposta do treinador</span>
          <p className="feedback__reply">{replied}</p>
        </section>
      )}

      <section className="card">
        <span className="eyebrow">Aderência, pelos teus registos</span>
        <div className="row">
          <Stat
            label="Treinos"
            value={`${done} de ${planned || '—'}`}
            tone={planned > 0 && done >= planned ? 'good' : 'default'}
          />
          <Stat label="Sono médio" value={hoursLabel(sleep)} />
        </div>
        <div className="row">
          <Stat label="Energia" value={energy ? `${num(energy, 1)} / 5` : '—'} />
          <Stat label="Fome" value={hunger ? `${num(hunger, 1)} / 5` : '—'} />
          <Stat label="Stress" value={stress ? `${num(stress, 1)} / 5` : '—'} />
        </div>
      </section>

      <section className="card">
        <span className="eyebrow">Ajuda-me a ajudar-te</span>

        {QUESTIONS.map((question) => (
          <label className="field" key={question.key}>
            <span className="field__label">{question.label}</span>
            {question.hint && <span className="feedback__hint">{question.hint}</span>}
            <textarea
              className="textarea"
              value={draft[question.key] ?? ''}
              disabled={sent}
              onChange={(event) =>
                setDraft((current) => ({ ...current, [question.key]: event.target.value }))
              }
            />
          </label>
        ))}

        <label className="field">
          <span className="field__label">Aderência à dieta (%)</span>
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            disabled={sent}
            value={draft.diet_adherence ?? ''}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                diet_adherence:
                  event.target.value === '' ? null : Number(event.target.value),
              }))
            }
          />
        </label>

        <Scale
          label="Motivação para a próxima semana"
          hint="1 a 10"
          max={10}
          tone="accent"
          value={draft.motivation ?? null}
          onChange={(value) =>
            !sent && setDraft((current) => ({ ...current, motivation: value }))
          }
        />

        {sent ? (
          <div className="feedback__sent">
            <p>Enviado ao treinador ✓</p>
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              onClick={() => setSent(false)}
            >
              Quero corrigir
            </button>
          </div>
        ) : (
          <div className="row">
            <button
              type="button"
              className="btn btn--quiet"
              disabled={saving}
              onClick={() => persist('draft')}
            >
              Guardar rascunho
            </button>
            <button
              type="button"
              className="btn btn--accent"
              disabled={saving}
              onClick={() => persist('sent')}
            >
              {saving ? 'A enviar…' : 'Enviar ao treinador'}
            </button>
          </div>
        )}
      </section>

      {history.length > 1 && (
        <section className="card card--flat">
          <span className="eyebrow">Semanas anteriores</span>
          <ul className="feedback__history">
            {history
              .filter((entry) => entry.week_start !== week)
              .map((entry) => (
                <li key={entry.id}>
                  <span>{shortDate(entry.week_start)}</span>
                  <span className="muted">
                    {entry.trainings_done ?? '—'}/{entry.trainings_planned ?? '—'} treinos
                  </span>
                  <span className="muted">
                    {entry.motivation ? `motivação ${entry.motivation}` : ''}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  )
}
