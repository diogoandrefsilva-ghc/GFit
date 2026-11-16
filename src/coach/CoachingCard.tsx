import { useState } from 'react'
import { NumberInput } from '@/components/NumberInput'
import {
  addTrainingSlot,
  confirmPayment,
  deletePayment,
  deleteTrainingSlot,
  fetchPayments,
  fetchTrainingSlots,
  saveAthleteProfile,
} from '@/lib/api'
import { WEEKDAY_NAMES, hhmm, periodOf, weekdayPlural } from '@/lib/agenda'
import { describeError } from '@/lib/supabase'
import { addMonths, euros, monthName, shortDate } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import type { AthleteProfile } from '@/lib/database.types'
import './coaching-card.css'

/** Segunda primeiro, como no resto da app. */
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]

/**
 * O que é combinado entre o treinador e o aluno e não muda de semana para
 * semana: em que dias e a que horas treinam juntos, e quanto é a mensalidade.
 * O dia de treino desenha o calendário sozinho; a mensalidade abre, todos os
 * meses, a pergunta "já pagou?".
 */
export function CoachingCard({
  athleteId,
  coachId,
  ficha,
  onFichaSaved,
}: {
  athleteId: string
  coachId: string
  ficha: AthleteProfile | null
  onFichaSaved: () => void
}) {
  const { data, error, reload } = useQuery(['aluno-combinado', athleteId], async () => {
    const [slots, payments] = await Promise.all([
      fetchTrainingSlots(athleteId),
      fetchPayments(athleteId, 6),
    ])
    return { slots, payments }
  })

  const [adding, setAdding] = useState(false)
  const [weekday, setWeekday] = useState(5)
  const [time, setTime] = useState('12:30')
  const [fee, setFee] = useState<number | null>(ficha?.monthly_fee ?? null)
  const [editingFee, setEditingFee] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      await action()
    } catch (caught) {
      setFailure(describeError(caught))
    } finally {
      setBusy(false)
    }
  }

  const slots = data?.slots ?? []
  const payments = data?.payments ?? []
  const monthlyFee = ficha?.monthly_fee ?? null

  // Este mês e os dois anteriores: chega para ver se há algum em atraso.
  const thisMonth = periodOf()
  const months = [thisMonth, addMonths(thisMonth, -1), addMonths(thisMonth, -2)]

  return (
    <section className="card">
      <span className="eyebrow">Treino presencial e mensalidade</span>

      {error && (
        <p className="error-banner">
          {error} Se isto ainda não foi activado na base de dados, falta aplicar a
          migração 15.
        </p>
      )}
      {failure && <p className="error-banner">{failure}</p>}

      {/* ── dias de treino ─────────────────────────── */}
      <div className="coaching__block">
        <div className="coaching__head">
          <span className="field__label">Treina comigo</span>
          {!adding && (
            <button
              type="button"
              className="btn btn--sm btn--quiet"
              onClick={() => setAdding(true)}
            >
              + Dia
            </button>
          )}
        </div>

        {slots.length === 0 && !adding && (
          <p className="coaching__empty muted">
            Sem dia fixo. Define-o (ex.: sextas às 12:30) e o treino passa a aparecer
            todas as semanas no calendário — e no Hoje do aluno, que diz se vai.
          </p>
        )}

        <ul className="coaching__slots">
          {slots.map((slot) => (
            <li key={slot.id}>
              <strong>
                {weekdayPlural(slot.weekday)} às {hhmm(slot.start_time)}
              </strong>
              <button
                type="button"
                className="coaching__remove"
                aria-label={`Remover ${weekdayPlural(slot.weekday)} às ${hhmm(slot.start_time)}`}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await deleteTrainingSlot(slot.id)
                    reload()
                  })
                }
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        {adding && (
          <div className="coaching__form">
            <div className="grid-2">
              <label className="field">
                <span className="field__label">Dia da semana</span>
                <select
                  className="select"
                  value={weekday}
                  onChange={(event) => setWeekday(Number(event.target.value))}
                >
                  {WEEKDAY_ORDER.map((value) => (
                    <option key={value} value={value}>
                      {WEEKDAY_NAMES[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">Hora</span>
                <input
                  className="input"
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                />
              </label>
            </div>
            <div className="row">
              <button type="button" className="btn btn--quiet" onClick={() => setAdding(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy || !time}
                onClick={() =>
                  run(async () => {
                    await addTrainingSlot(coachId, athleteId, weekday, time)
                    setAdding(false)
                    reload()
                  })
                }
              >
                Guardar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── mensalidade ────────────────────────────── */}
      <div className="coaching__block">
        <div className="coaching__head">
          <span className="field__label">Mensalidade</span>
          {!editingFee && (
            <button
              type="button"
              className="btn btn--sm btn--quiet"
              onClick={() => {
                setFee(monthlyFee)
                setEditingFee(true)
              }}
            >
              {monthlyFee === null ? 'Definir' : 'Alterar'}
            </button>
          )}
        </div>

        {editingFee ? (
          <div className="coaching__form">
            <label className="field">
              <span className="field__label">Valor por mês (€)</span>
              <NumberInput value={fee} decimals={2} onChange={setFee} />
              <span className="field__hint">vazio: não acompanhar os pagamentos deste aluno</span>
            </label>
            <div className="row">
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => setEditingFee(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    await saveAthleteProfile(athleteId, { monthly_fee: fee })
                    setEditingFee(false)
                    onFichaSaved()
                  })
                }
              >
                Guardar
              </button>
            </div>
          </div>
        ) : monthlyFee === null ? (
          <p className="coaching__empty muted">
            Sem valor definido. Com ele, o aluno passa a ter no Hoje um botão “Já
            paguei”, e tu validas aqui ou no Início.
          </p>
        ) : (
          <>
            <strong className="coaching__fee">{euros(monthlyFee)} por mês</strong>
            <ul className="coaching__months">
              {months.map((period) => {
                const payment = payments.find((item) => item.period === period)
                const confirmed = Boolean(payment?.confirmed_at)
                return (
                  <li key={period}>
                    <span className="coaching__month">
                      <strong>{monthName(period)}</strong>
                      <em>
                        {confirmed
                          ? `pago · validado a ${shortDate(payment!.confirmed_at!.slice(0, 10))}`
                          : payment?.paid_at
                            ? `o aluno diz que pagou a ${shortDate(payment.paid_at.slice(0, 10))}`
                            : 'por pagar'}
                      </em>
                    </span>
                    {confirmed ? (
                      <button
                        type="button"
                        className="chip chip--good"
                        disabled={busy}
                        title="Anular o pagamento"
                        onClick={() => {
                          if (!window.confirm(`Anular o pagamento de ${monthName(period)}?`)) return
                          run(async () => {
                            await deletePayment(payment!.id)
                            reload()
                          })
                        }}
                      >
                        pago ✓
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`btn btn--sm ${payment?.paid_at ? 'btn--primary' : 'btn--ghost'}`}
                        disabled={busy}
                        onClick={() =>
                          run(async () => {
                            await confirmPayment(
                              coachId,
                              athleteId,
                              period,
                              Number(payment?.amount ?? monthlyFee),
                            )
                            reload()
                          })
                        }
                      >
                        {payment?.paid_at ? 'Validar' : 'Marcar pago'}
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
