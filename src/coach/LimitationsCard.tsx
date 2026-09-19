import { useState } from 'react'
import {
  addLimitation,
  deleteLimitation,
  resolveLimitation,
} from '@/lib/api'
import { isoDate, shortDate } from '@/lib/format'
import type { AthleteLimitation } from '@/lib/database.types'

/**
 * Limitações com princípio e fim. Uma lesão que já sarou não se apaga: passa a
 * resolvida, porque saber que existiu continua a valer na hora de escolher
 * exercícios.
 */
export function LimitationsCard({
  athleteId,
  coachId,
  limitations,
  onChanged,
}: {
  athleteId: string
  coachId: string
  limitations: AthleteLimitation[]
  onChanged: () => void
}) {
  const [body, setBody] = useState('')
  const [startedOn, setStartedOn] = useState(isoDate())
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showPast, setShowPast] = useState(false)

  const active = limitations.filter((item) => !item.resolved_on)
  const past = limitations.filter((item) => item.resolved_on)

  return (
    <section className={`card ${active.length > 0 ? 'card--warn' : ''}`}>
      <div className="card__head">
        <span className="eyebrow">
          Limitações{active.length > 0 ? ` · ${active.length} activa${active.length > 1 ? 's' : ''}` : ''}
        </span>
        <button
          type="button"
          className="btn btn--sm btn--quiet"
          onClick={() => setAdding(!adding)}
        >
          {adding ? 'Fechar' : '+ Nova'}
        </button>
      </div>

      {active.length === 0 && !adding && (
        <p className="subtitle">Sem limitações registadas.</p>
      )}

      {active.length > 0 && (
        <ul className="limitations">
          {active.map((item) => (
            <li key={item.id}>
              <div className="limitations__text">
                <p>{item.body}</p>
                <span className="muted">desde {shortDate(item.started_on)}</span>
              </div>
              <div className="row">
                <button
                  type="button"
                  className="btn btn--sm btn--quiet"
                  onClick={async () => {
                    await resolveLimitation(item.id, isoDate())
                    onChanged()
                  }}
                >
                  Resolvida
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn--quiet"
                  onClick={async () => {
                    await deleteLimitation(item.id)
                    onChanged()
                  }}
                  aria-label="Apagar limitação"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="limitations__form">
          <label className="field">
            <span className="field__label">O que limita</span>
            <textarea
              className="textarea"
              value={body}
              placeholder="Trombo na perna · artrite. Evitar impacto e cargas máximas."
              onChange={(event) => setBody(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">Desde</span>
            <input
              className="input"
              type="date"
              value={startedOn}
              onChange={(event) => setStartedOn(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn--primary btn--block"
            disabled={busy || body.trim().length === 0}
            onClick={async () => {
              setBusy(true)
              try {
                await addLimitation(athleteId, coachId, body.trim(), startedOn)
                setBody('')
                setStartedOn(isoDate())
                setAdding(false)
                onChanged()
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'A guardar…' : 'Registar'}
          </button>
        </div>
      )}

      {past.length > 0 && (
        <>
          <button
            type="button"
            className="detail__more"
            onClick={() => setShowPast(!showPast)}
          >
            {showPast
              ? 'esconder resolvidas'
              : `${past.length} resolvida${past.length > 1 ? 's' : ''}`}
          </button>
          {showPast && (
            <ul className="limitations limitations--past">
              {past.map((item) => (
                <li key={item.id}>
                  <div className="limitations__text">
                    <p>{item.body}</p>
                    <span className="muted">
                      {shortDate(item.started_on)} a {shortDate(item.resolved_on!)}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="btn btn--sm btn--quiet"
                    onClick={async () => {
                      await resolveLimitation(item.id, null)
                      onChanged()
                    }}
                  >
                    Reabrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}
