import { useState } from 'react'
import { saveCoachNote } from '@/lib/api'
import { shortDate } from '@/lib/format'
import type { CoachNote } from '@/lib/database.types'
import './ficha.css'

/**
 * Notas do dia, com o rasto do que já foi dito. O treinador escreve-as ao
 * aluno; quem treina por sua conta escreve-as a si próprio, e passam a ser o
 * caderno do acompanhamento — que é a mesma coisa vista do outro lado.
 */
export function NotesCard({
  coachId,
  athleteId,
  notes,
  self = false,
  onSaved,
}: {
  coachId: string
  athleteId: string
  notes: CoachNote[]
  /** As notas são para quem as escreve. */
  self?: boolean
  onSaved: () => void
}) {
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAll, setShowAll] = useState(false)

  const visible = showAll ? notes : notes.slice(0, 3)

  return (
    <section className="card card--accent">
      <span className="eyebrow">{self ? 'Notas' : 'Notas e conselhos'}</span>
      <p className="subtitle">
        {self
          ? 'A mais recente aparece no teu ecrã "Hoje".'
          : 'A mais recente aparece no ecrã "Hoje" do aluno.'}
      </p>

      <textarea
        className="textarea"
        value={body}
        placeholder={
          self
            ? 'O ombro reclamou no supino inclinado. Para a semana, menos amplitude.'
            : 'Hoje sobe 2,5 kg no supino. Se a perna incomodar, avisa-me.'
        }
        onChange={(event) => setBody(event.target.value)}
      />
      <button
        type="button"
        className="btn btn--primary btn--block"
        disabled={busy || body.trim().length === 0}
        onClick={async () => {
          setBusy(true)
          try {
            await saveCoachNote(coachId, athleteId, body.trim())
            setBody('')
            onSaved()
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'A guardar…' : self ? 'Guardar nota' : 'Enviar nota'}
      </button>

      {notes.length > 0 && (
        <ul className="notes">
          {visible.map((note) => (
            <li key={note.id}>
              <span className="notes__date">
                {shortDate(note.note_date)}
                {!self && note.read_at ? ' · lida' : ''}
              </span>
              <p>{note.body}</p>
            </li>
          ))}
          {notes.length > 3 && (
            <li>
              <button
                type="button"
                className="more-link"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? 'mostrar menos' : `ver as ${notes.length} notas`}
              </button>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
