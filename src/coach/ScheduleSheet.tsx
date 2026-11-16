import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sheet } from '@/components/Sheet'
import { fetchSchedulablePlans, scheduleWorkouts } from '@/lib/api'
import { describeError } from '@/lib/supabase'
import { isoDate, longDate } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import type { Profile } from '@/lib/database.types'
import './agenda.css'

/**
 * Marcar um treino sem ir ao editor do plano: aluno, plano, treino, dia. É o
 * caminho curto para "amanhã o David faz o A" — o calendário do plano continua
 * a ser onde se monta a semana inteira e se repete até ao fim.
 */
export function ScheduleSheet({
  coachId,
  athletes,
  athleteId: presetAthlete = null,
  date: presetDate,
  onClose,
  onDone,
}: {
  coachId: string
  athletes: Profile[]
  athleteId?: string | null
  date?: string
  onClose: () => void
  onDone: () => void
}) {
  const active = athletes.filter((athlete) => athlete.status === 'active')
  const [athleteId, setAthleteId] = useState<string>(presetAthlete ?? active[0]?.id ?? '')
  const [planId, setPlanId] = useState<string | null>(null)
  const [dayId, setDayId] = useState<string | null>(null)
  const [date, setDate] = useState(presetDate ?? isoDate())
  const [time, setTime] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [marked, setMarked] = useState<string | null>(null)

  const { data: plans, loading } = useQuery(
    ['marcar-planos', athleteId, coachId],
    () => (athleteId ? fetchSchedulablePlans(athleteId, coachId) : Promise.resolve([])),
    { persist: false },
  )

  // O plano mais recente é o que quase sempre se quer; só se pergunta se houver dois.
  const plan = plans?.find((item) => item.plan.id === planId) ?? plans?.[0] ?? null
  const day = plan?.days.find((item) => item.id === dayId) ?? null

  async function save() {
    if (!plan || !day || !date || busy) return
    setBusy(true)
    setFailure(null)
    try {
      await scheduleWorkouts([
        {
          athlete_id: athleteId,
          coach_id: coachId,
          plan_id: plan.plan.id,
          plan_day_id: day.id,
          scheduled_on: date,
          starts_at: time || null,
        },
      ])
      setMarked(
        `Treino ${day.label} marcado para ${longDate(date).toLowerCase()}${time ? ` às ${time}` : ''}.`,
      )
      setDayId(null)
      onDone()
    } catch (caught) {
      setFailure(describeError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Marcar treino" caption="aluno, treino e dia" done="Fechar" onClose={onClose}>
      {active.length === 0 ? (
        <p className="subtitle">Ainda não tens alunos activos a quem marcar treinos.</p>
      ) : (
        <>
          <label className="field">
            <span className="field__label">Aluno</span>
            <select
              className="select"
              value={athleteId}
              onChange={(event) => {
                setAthleteId(event.target.value)
                setPlanId(null)
                setDayId(null)
                setMarked(null)
              }}
            >
              {active.map((athlete) => (
                <option key={athlete.id} value={athlete.id}>
                  {athlete.full_name ?? athlete.email}
                </option>
              ))}
            </select>
          </label>

          {loading ? (
            <p className="muted agenda-sheet__hint">A carregar os planos…</p>
          ) : !plan ? (
            <p className="agenda-sheet__hint">
              Este aluno ainda não tem um plano publicado. Os treinos marcam-se a partir
              de um plano: <Link to={`/alunos/${athleteId}`}>abre a ficha</Link>, cria o
              plano no separador Planos e publica-o.
            </p>
          ) : (
            <>
              {plans!.length > 1 && (
                <div className="field">
                  <span className="field__label">Plano</span>
                  <div className="row row--wrap">
                    {plans!.map((item) => (
                      <button
                        key={item.plan.id}
                        type="button"
                        className={`chip ${item.plan.id === plan.plan.id ? 'chip--on' : ''}`}
                        onClick={() => {
                          setPlanId(item.plan.id)
                          setDayId(null)
                        }}
                      >
                        {item.plan.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="field">
                <span className="field__label">
                  Treino{plans!.length === 1 ? ` · ${plan.plan.name}` : ''}
                </span>
                {plan.days.length === 0 ? (
                  <p className="muted agenda-sheet__hint">
                    Este plano ainda não tem treinos com exercícios.
                  </p>
                ) : (
                  <ul className="agenda-sheet__days">
                    {plan.days.map((item) => (
                      <li key={item.id}>
                        <button
                          type="button"
                          className={`agenda-sheet__day ${item.id === day?.id ? 'is-on' : ''}`}
                          aria-pressed={item.id === day?.id}
                          onClick={() => {
                            setDayId(item.id)
                            setMarked(null)
                          }}
                        >
                          <span className="agenda-sheet__letter">{item.label}</span>
                          <span className="agenda-row__text">
                            <strong>{item.title ?? `Treino ${item.label}`}</strong>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="grid-2">
                <label className="field">
                  <span className="field__label">Dia</span>
                  <input
                    className="input"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="field__label">Hora (opcional)</span>
                  <input
                    className="input"
                    type="time"
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </label>
              </div>

              {failure && <p className="error-banner">{failure}</p>}
              {marked && <p className="agenda-sheet__done">{marked} Podes marcar outro.</p>}

              <button
                type="button"
                className="btn btn--accent btn--block"
                disabled={busy || !day || !date}
                onClick={save}
              >
                {busy ? 'A marcar…' : day ? `Marcar o treino ${day.label}` : 'Escolhe o treino'}
              </button>
            </>
          )}
        </>
      )}
    </Sheet>
  )
}
