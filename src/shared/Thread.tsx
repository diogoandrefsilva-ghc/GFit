import { useEffect, useMemo, useRef, useState } from 'react'
import { Loading } from '@/components/Screen'
import {
  fetchFeedbackHistory,
  fetchThread,
  markThreadRead,
  saveCoachNote,
} from '@/lib/api'
import { describeError } from '@/lib/supabase'
import { daysBetween, isoDate, relativeDate, shortDate } from '@/lib/format'
import { useQuery } from '@/lib/useQuery'
import type { CoachNote, WeeklyFeedback } from '@/lib/database.types'
import './thread.css'

type Item =
  | { kind: 'message'; at: string; mine: boolean; note: CoachNote }
  | { kind: 'feedback'; at: string; entry: WeeklyFeedback }
  | { kind: 'reply'; at: string; mine: boolean; entry: WeeklyFeedback }

const clockOf = (at: string) =>
  new Date(at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

/**
 * O fio entre treinador e aluno, o mesmo dos dois lados. Junta num só sítio o
 * que antes vivia em três: as notas do treinador, a resposta dele ao feedback
 * da semana, e — o que não havia — o que o aluno lhe quer dizer.
 *
 * O feedback semanal entra como marco ("enviou o feedback da semana 3") e não
 * como mensagem: tem o seu ecrã, com as perguntas todas. A resposta do
 * treinador a esse feedback, essa sim, é conversa.
 */
export function Thread({
  athleteId,
  coachId,
  meId,
  otherName,
  onChanged,
}: {
  athleteId: string
  /** O treinador deste fio. */
  coachId: string
  /** Quem está a ler e a escrever. */
  meId: string
  /** O primeiro nome do outro lado, para o texto de quando ainda não há nada. */
  otherName: string
  /** Leu-se ou escreveu-se alguma coisa: quem mostra a ponta do fio relê-a. */
  onChanged?: () => void
}) {
  const iAmCoach = meId === coachId

  const { data, loading, error, reload, mutate } = useQuery(
    ['conversa', athleteId],
    async () => {
      const [notes, feedback] = await Promise.all([
        fetchThread(athleteId),
        fetchFeedbackHistory(athleteId, 8).catch(() => [] as WeeklyFeedback[]),
      ])
      return { notes, feedback }
    },
  )

  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const onChangedRef = useRef(onChanged)
  onChangedRef.current = onChanged

  const items = useMemo<Item[]>(() => {
    if (!data) return []
    const list: Item[] = data.notes.map((note) => ({
      kind: 'message',
      at: note.created_at,
      mine: (note.author_id ?? note.coach_id) === meId,
      note,
    }))
    for (const entry of data.feedback) {
      if (entry.status !== 'sent') continue
      list.push({ kind: 'feedback', at: entry.sent_at ?? entry.created_at, entry })
      if (entry.coach_reply && entry.coach_replied_at) {
        list.push({ kind: 'reply', at: entry.coach_replied_at, mine: iAmCoach, entry })
      }
    }
    return list.sort((a, b) => a.at.localeCompare(b.at))
  }, [data, meId, iAmCoach])

  // O que o outro lado escreveu e ainda não foi lido passa a lido ao abrir.
  const unread = (data?.notes ?? []).filter(
    (note) => !note.read_at && (note.author_id ?? note.coach_id) !== meId,
  ).length
  useEffect(() => {
    if (unread === 0) return
    markThreadRead(athleteId, meId)
      .then(() => onChangedRef.current?.())
      .catch(() => {})
  }, [unread, athleteId, meId])

  // Abre-se no fim, onde está o que é novo e onde se escreve.
  const count = items.length
  useEffect(() => {
    if (count > 0) end.current?.scrollIntoView({ block: 'end' })
  }, [count])

  if (loading) return <Loading label="A carregar a conversa" />
  if (error) return <p className="error-banner">{error}</p>

  async function send() {
    const text = body.trim()
    if (!text || busy) return
    setBusy(true)
    setFailure(null)
    try {
      const saved = await saveCoachNote(coachId, athleteId, text)
      mutate((current) => ({ ...current, notes: [...current.notes, saved] }))
      setBody('')
      onChanged?.()
    } catch (caught) {
      setFailure(describeError(caught))
      reload()
    } finally {
      setBusy(false)
    }
  }

  let lastDay = ''

  return (
    <div className="thread">
      {items.length === 0 && (
        <p className="thread__empty muted">
          {iAmCoach
            ? `Ainda não há mensagens. O que escreveres aqui aparece no "Hoje" de ${otherName}.`
            : `Ainda não há mensagens. Escreve a ${otherName} quando tiveres uma dúvida ou quiseres contar como correu.`}
        </p>
      )}

      <ol className="thread__list">
        {items.map((item) => {
          const day = isoDate(new Date(item.at))
          const divider = day !== lastDay
          lastDay = day
          return (
            <li key={`${item.kind}-${item.kind === 'message' ? item.note.id : item.entry.id}`}>
              {divider && (
                <span className="thread__day">
                  {daysBetween(day, isoDate()) <= 1 ? relativeDate(day) : shortDate(day)}
                </span>
              )}

              {item.kind === 'feedback' ? (
                <p className="thread__event">
                  {iAmCoach ? 'Enviou' : 'Enviaste'} o feedback da semana{' '}
                  {item.entry.week_number}
                  {item.entry.motivation ? ` · motivação ${item.entry.motivation}/10` : ''}
                </p>
              ) : (
                <div className={`bubble ${item.mine ? 'bubble--mine' : ''}`}>
                  {item.kind === 'reply' && (
                    <span className="bubble__tag">
                      sobre o feedback da semana {item.entry.week_number}
                    </span>
                  )}
                  <p>{item.kind === 'reply' ? item.entry.coach_reply : item.note.body}</p>
                  <span className="bubble__meta">
                    {clockOf(item.at)}
                    {item.kind === 'message' && item.mine && item.note.read_at ? ' · lida' : ''}
                  </span>
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <div className="thread__composer">
        <textarea
          className="textarea thread__input"
          value={body}
          rows={2}
          placeholder={
            iAmCoach
              ? 'Hoje sobe 2,5 kg no supino. Se a perna incomodar, avisa-me.'
              : 'O ombro reclamou no supino inclinado. Baixo a carga?'
          }
          onChange={(event) => setBody(event.target.value)}
        />
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={busy || body.trim().length === 0}
          onClick={send}
        >
          {busy ? 'A enviar…' : 'Enviar'}
        </button>
        {failure && <p className="error-banner">{failure}</p>}
      </div>
      <div ref={end} />
    </div>
  )
}
