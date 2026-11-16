import { useState } from 'react'
import { Segmented } from '@/components/Segmented'
import { declarePaid, deletePayment, saveAttendance } from '@/lib/api'
import type { Presence } from '@/lib/agenda'
import { describeError } from '@/lib/supabase'
import { addDays, euros, isoDate, longDate, monthName, shortDate } from '@/lib/format'
import type { Payment } from '@/lib/database.types'
import './coach-cards.css'

/**
 * O próximo treino com o treinador. Está sempre marcado — é o dia e a hora
 * combinados —, por isso a pergunta já vem respondida: "Sim". Só quem não vai
 * é que tem de dizer alguma coisa, e pode logo propor outra data.
 */
export function NextPresenceCard({
  presence,
  coachName,
  onChanged,
}: {
  presence: Presence
  coachName: string | null
  onChanged: () => void
}) {
  const answer = presence.attendance
  const going = presence.status === 'going' || presence.status === 'moved'
  const [date, setDate] = useState(answer?.proposed_date ?? addDays(presence.originalDate, 1))
  const [time, setTime] = useState(answer?.proposed_time?.slice(0, 5) ?? presence.time)
  const [note, setNote] = useState(answer?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function reply(values: Parameters<typeof saveAttendance>[2]) {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      await saveAttendance(presence.slot, presence.originalDate, values)
      onChanged()
    } catch (caught) {
      setFailure(describeError(caught))
    } finally {
      setBusy(false)
    }
  }

  const today = isoDate()
  const day =
    presence.date === today
      ? 'Hoje'
      : presence.date === addDays(today, 1)
        ? 'Amanhã'
        : longDate(presence.date)
  const declined = answer?.proposed_date && answer.proposal_accepted === false

  return (
    <section className={`card presence ${going ? '' : 'presence--out'}`}>
      <span className="eyebrow">Próximo treino presencial</span>
      <h2 className="presence__when">
        {day} · {presence.time}
      </h2>
      <p className="presence__meta muted">
        {presence.status === 'moved'
          ? `mudado de ${longDate(presence.originalDate).toLowerCase()}, combinado com o treinador`
          : coachName
            ? `com ${coachName.split(' ')[0]}`
            : 'com o treinador'}
      </p>

      <div className="presence__ask">
        <span className="field__label">Vais ao treino?</span>
        <Segmented<'sim' | 'nao'>
          value={going ? 'sim' : 'nao'}
          options={[
            ['sim', 'Sim'],
            ['nao', 'Não'],
          ]}
          onChange={(value) => reply({ going: value === 'sim' })}
          label="Vais ao treino?"
        />
      </div>

      {failure && <p className="error-banner">{failure}</p>}

      {!going && (
        <div className="presence__propose">
          {presence.status === 'proposed' ? (
            <p className="presence__state">
              Propuseste{' '}
              <strong>
                {longDate(answer!.proposed_date!).toLowerCase()}
                {answer!.proposed_time ? ` às ${answer!.proposed_time.slice(0, 5)}` : ''}
              </strong>
              . À espera da resposta do treinador.
            </p>
          ) : (
            <p className="presence__state">
              {declined
                ? 'O treinador não pode na data que propuseste. Queres propor outra?'
                : 'O treinador fica a saber que não vais. Queres propor outra data?'}
            </p>
          )}

          <div className="grid-2">
            <label className="field">
              <span className="field__label">Outro dia</span>
              <input
                className="input"
                type="date"
                min={today}
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
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
          <label className="field">
            <span className="field__label">Nota (opcional)</span>
            <input
              className="input"
              value={note}
              placeholder="Tenho uma consulta a essa hora."
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy || !date}
            onClick={() =>
              reply({
                going: false,
                proposed_date: date,
                proposed_time: time || null,
                note: note.trim() || null,
              })
            }
          >
            {presence.status === 'proposed' ? 'Mudar a proposta' : 'Propor esta data'}
          </button>
        </div>
      )}
    </section>
  )
}

/**
 * A mensalidade do mês. O aluno diz que pagou; quem confirma é o treinador.
 * Depois de validada fica uma linha só — já não há nada a fazer.
 */
export function FeeCard({
  athleteId,
  fee,
  period,
  payment,
  onChanged,
}: {
  athleteId: string
  fee: number
  period: string
  payment: Payment | null
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setFailure(null)
    try {
      await action()
      onChanged()
    } catch (caught) {
      setFailure(describeError(caught))
    } finally {
      setBusy(false)
    }
  }

  if (payment?.confirmed_at) {
    return (
      <p className="fee__settled muted">
        Mensalidade de {monthName(period)} paga ✓ · {euros(payment.amount)}
      </p>
    )
  }

  return (
    <section className="card card--flat fee">
      <div className="fee__text">
        <span className="eyebrow">Mensalidade de {monthName(period)}</span>
        <strong className="fee__amount">{euros(payment?.amount ?? fee)}</strong>
        <em className="fee__state">
          {payment?.paid_at
            ? `Disseste que pagaste a ${shortDate(payment.paid_at.slice(0, 10))} · à espera que o treinador valide`
            : 'Quando pagares, avisa aqui o treinador.'}
        </em>
      </div>
      {payment?.paid_at ? (
        <button
          type="button"
          className="btn btn--sm btn--quiet"
          disabled={busy}
          onClick={() => run(() => deletePayment(payment.id))}
        >
          Anular
        </button>
      ) : (
        <button
          type="button"
          className="btn btn--sm btn--primary"
          disabled={busy}
          onClick={() => run(() => declarePaid(athleteId, period, fee))}
        >
          Já paguei
        </button>
      )}
      {failure && <p className="error-banner fee__error">{failure}</p>}
    </section>
  )
}
