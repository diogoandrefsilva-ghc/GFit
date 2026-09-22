import { useState } from 'react'
import { saveAthleteProfile } from '@/lib/api'
import { describeError } from '@/lib/supabase'
import { num, parseIso } from '@/lib/format'
import type { AthleteProfile } from '@/lib/database.types'
import './ficha.css'

/** Idade a partir da data de nascimento, contando se já fez anos este ano. */
function ageOf(birthDate: string): number {
  const born = parseIso(birthDate)
  const today = new Date()
  let age = today.getFullYear() - born.getFullYear()
  const beforeBirthday =
    today.getMonth() < born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() < born.getDate())
  if (beforeBirthday) age -= 1
  return age
}

/**
 * O que não muda no aluno: nascimento, sexo, altura, profissão. Fica em cima do
 * resumo porque é o contexto com que se lê tudo o resto, e é curto o suficiente
 * para não justificar um separador só para si.
 */
export function IdentityCard({
  athleteId,
  ficha,
  onSaved,
}: {
  athleteId: string
  ficha: AthleteProfile | null
  onSaved: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Partial<AthleteProfile>>(ficha ?? {})
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const set = (patch: Partial<AthleteProfile>) =>
    setForm((current) => ({ ...current, ...patch }))
  const numberOrNull = (value: string) => (value === '' ? null : Number(value))

  if (!editing) {
    const facts: [string, string][] = [
      [
        'Idade',
        ficha?.birth_date ? `${ageOf(ficha.birth_date)} anos` : '—',
      ],
      ['Altura', ficha?.height_cm ? `${num(ficha.height_cm, 0)} cm` : '—'],
      ['Sexo', ficha?.sex === 'M' ? 'Masculino' : ficha?.sex === 'F' ? 'Feminino' : '—'],
      ['Profissão', ficha?.occupation || '—'],
    ]

    return (
      <section className="card">
        <div className="card__head">
          <span className="eyebrow">Quem é</span>
          <button
            type="button"
            className="btn btn--sm btn--quiet"
            onClick={() => {
              setForm(ficha ?? {})
              setEditing(true)
            }}
          >
            {ficha ? 'Editar' : 'Preencher'}
          </button>
        </div>
        <ul className="identity">
          {facts.map(([label, value]) => (
            <li key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </li>
          ))}
        </ul>
        {ficha?.pack_end_date && (
          <p className="identity__pack muted">
            Pack até {ficha.pack_end_date.split('-').reverse().join('/')}
          </p>
        )}
      </section>
    )
  }

  return (
    <section className="card">
      <span className="eyebrow">Quem é</span>

      <div className="grid-2">
        <label className="field">
          <span className="field__label">Data de nascimento</span>
          <input
            className="input"
            type="date"
            max="2026-12-31"
            value={form.birth_date ?? ''}
            onChange={(event) => set({ birth_date: event.target.value || null })}
          />
          <span className="field__hint">dia / mês / ano</span>
        </label>

        <label className="field">
          <span className="field__label">Altura (cm)</span>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            min={100}
            max={250}
            value={form.height_cm ?? ''}
            onChange={(event) => set({ height_cm: numberOrNull(event.target.value) })}
          />
        </label>
      </div>

      <div className="field">
        <span className="field__label">Sexo</span>
        <div className="row">
          {(
            [
              ['M', 'Masculino'],
              ['F', 'Feminino'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip ${form.sex === value ? 'chip--on' : ''}`}
              onClick={() => set({ sex: form.sex === value ? null : value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <label className="field">
        <span className="field__label">Profissão / ocupação</span>
        <input
          className="input"
          value={form.occupation ?? ''}
          placeholder="Escritório, turnos, trabalho físico…"
          onChange={(event) => set({ occupation: event.target.value || null })}
        />
      </label>

      <div className="grid-2">
        <label className="field">
          <span className="field__label">Fim do pack</span>
          <input
            className="input"
            type="date"
            value={form.pack_end_date ?? ''}
            onChange={(event) => set({ pack_end_date: event.target.value || null })}
          />
          <span className="field__hint">quando acaba o acompanhamento</span>
        </label>

        <label className="field">
          <span className="field__label">Próxima avaliação</span>
          <input
            className="input"
            type="date"
            value={form.next_update_date ?? ''}
            onChange={(event) => set({ next_update_date: event.target.value || null })}
          />
          <span className="field__hint">medidas e fotos</span>
        </label>
      </div>

      {failure && <p className="error-banner">{failure}</p>}

      <div className="row">
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => {
            setFailure(null)
            setEditing(false)
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setFailure(null)
            try {
              await saveAthleteProfile(athleteId, form)
              setEditing(false)
              onSaved()
            } catch (caught) {
              setFailure(describeError(caught))
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
    </section>
  )
}
