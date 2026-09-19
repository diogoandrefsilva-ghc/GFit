import { useState } from 'react'
import { Stat } from '@/components/Screen'
import { deleteTargets, saveTargets } from '@/lib/api'
import { describeError } from '@/lib/supabase'
import { int, isoDate, num, shortDate } from '@/lib/format'
import { WEIGHT_DIRECTION_LABEL } from '@/lib/calc'
import type { AthleteTargets, WeightDirection } from '@/lib/database.types'
import './ficha.css'

/**
 * As metas são revisões datadas, não um formulário que se sobrescreve. Cada vez
 * que se muda o rumo fica o registo de quando foi e do que era antes — que é
 * como se percebe, três meses depois, o que é que resultou.
 *
 * Serve os dois lados: o treinador a definir as metas de um aluno, e quem
 * treina por sua conta a definir as suas. Só muda o texto.
 */
export function TargetsTab({
  athleteId,
  coachId,
  current,
  history,
  self = false,
  onChanged,
}: {
  athleteId: string
  coachId: string
  current: AthleteTargets | null
  history: AthleteTargets[]
  /** As metas são de quem está a olhar para elas. */
  self?: boolean
  onChanged: () => void
}) {
  const [editing, setEditing] = useState<AthleteTargets | 'new' | null>(
    history.length === 0 ? 'new' : null,
  )

  return (
    <>
      {current ? (
        <section className="card">
          <div className="card__head">
            <span className="eyebrow">
              Em vigor desde {shortDate(current.effective_from)}
            </span>
            <button
              type="button"
              className="btn btn--sm btn--quiet"
              onClick={() => setEditing(current)}
            >
              Editar
            </button>
          </div>

          {current.objective && (
            <div className="targets__objective">
              <span className="field__label">Objetivo</span>
              <p>{current.objective}</p>
            </div>
          )}

          {current.weight_direction && (
            <span className="chip chip--good targets__direction">
              {WEIGHT_DIRECTION_LABEL[current.weight_direction]}
            </span>
          )}

          <div className="row">
            <Stat label="Kcal" value={current.kcal_target ? int(current.kcal_target) : '—'} />
            <Stat
              label="Peso alvo"
              value={current.weight_target_kg ? `${num(current.weight_target_kg, 1)} kg` : '—'}
            />
          </div>
          <div className="row">
            <Stat
              label="Proteína"
              value={current.protein_target_g ? `${current.protein_target_g} g` : '—'}
            />
            <Stat
              label="Gordura"
              value={current.fat_target_g ? `${current.fat_target_g} g` : '—'}
            />
            <Stat
              label="Hidratos"
              value={current.carb_target_g ? `${current.carb_target_g} g` : '—'}
            />
          </div>
          <div className="row">
            <Stat label="Passos" value={current.steps_goal ? int(current.steps_goal) : '—'} />
            <Stat
              label="Sono"
              value={current.sleep_goal_hours ? `${num(current.sleep_goal_hours, 1)} h` : '—'}
            />
          </div>

          {current.notes && <p className="targets__notes">{current.notes}</p>}
        </section>
      ) : (
        <section className="card">
          <span className="eyebrow">Metas</span>
          <p className="subtitle">
            Ainda não há metas definidas {self ? 'para ti' : 'para este aluno'}. A
            primeira revisão fica a valer a partir da data que escolheres.
          </p>
        </section>
      )}

      {editing ? (
        <TargetsForm
          athleteId={athleteId}
          coachId={coachId}
          initial={editing === 'new' ? null : editing}
          previous={current}
          onDone={() => {
            setEditing(null)
            onChanged()
          }}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button
          type="button"
          className="btn btn--accent btn--block"
          onClick={() => setEditing('new')}
        >
          + Nova revisão de metas
        </button>
      )}

      {history.length > 0 && (
        <section className="card card--flat">
          <span className="eyebrow">Histórico · {history.length}</span>
          <ul className="targets__history">
            {history.map((entry) => (
              <li key={entry.id} className={entry.id === current?.id ? 'is-current' : ''}>
                <div className="targets__history-head">
                  <strong>{shortDate(entry.effective_from)}</strong>
                  {entry.id === current?.id && (
                    <span className="chip chip--good">em vigor</span>
                  )}
                  <button
                    type="button"
                    className="btn btn--sm btn--quiet"
                    onClick={() => setEditing(entry)}
                  >
                    Ver
                  </button>
                </div>
                <p className="targets__history-line">
                  {[
                    entry.kcal_target ? `${int(entry.kcal_target)} kcal` : null,
                    entry.protein_target_g ? `P ${entry.protein_target_g}` : null,
                    entry.fat_target_g ? `G ${entry.fat_target_g}` : null,
                    entry.carb_target_g ? `H ${entry.carb_target_g}` : null,
                    entry.weight_target_kg
                      ? `alvo ${num(entry.weight_target_kg, 1)} kg`
                      : null,
                    entry.weight_direction
                      ? WEIGHT_DIRECTION_LABEL[entry.weight_direction].toLowerCase()
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'sem números'}
                </p>
                {entry.objective && (
                  <p className="targets__history-goal">{entry.objective}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

function TargetsForm({
  athleteId,
  coachId,
  initial,
  previous,
  onDone,
  onCancel,
}: {
  athleteId: string
  coachId: string
  initial: AthleteTargets | null
  previous: AthleteTargets | null
  onDone: () => void
  onCancel: () => void
}) {
  // Uma revisão nova parte dos valores em vigor: quase sempre muda-se uma coisa
  // ou duas, não tudo.
  const seed = initial ?? previous
  const [form, setForm] = useState<Partial<AthleteTargets>>({
    effective_from: initial?.effective_from ?? isoDate(),
    objective: seed?.objective ?? null,
    kcal_target: seed?.kcal_target ?? null,
    protein_target_g: seed?.protein_target_g ?? null,
    fat_target_g: seed?.fat_target_g ?? null,
    carb_target_g: seed?.carb_target_g ?? null,
    steps_goal: seed?.steps_goal ?? 9000,
    sleep_goal_hours: seed?.sleep_goal_hours ?? 8,
    weight_target_kg: seed?.weight_target_kg ?? null,
    weight_direction: seed?.weight_direction ?? null,
    notes: initial?.notes ?? null,
  })
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const set = (patch: Partial<AthleteTargets>) =>
    setForm((current) => ({ ...current, ...patch }))
  const numberOrNull = (value: string) => (value === '' ? null : Number(value))

  const numberField = (
    label: string,
    key: 'kcal_target' | 'protein_target_g' | 'fat_target_g' | 'carb_target_g' | 'steps_goal',
  ) => (
    <label className="field">
      <span className="field__label">{label}</span>
      <input
        className="input"
        type="number"
        inputMode="numeric"
        value={form[key] ?? ''}
        onChange={(event) => set({ [key]: numberOrNull(event.target.value) })}
      />
    </label>
  )

  return (
    <section className="card">
      <span className="eyebrow">
        {initial ? `Revisão de ${shortDate(initial.effective_from)}` : 'Nova revisão'}
      </span>

      <label className="field">
        <span className="field__label">A valer a partir de</span>
        <input
          className="input"
          type="date"
          value={form.effective_from ?? ''}
          onChange={(event) => set({ effective_from: event.target.value })}
        />
        <span className="field__hint">
          uma revisão por dia; guardar no mesmo dia corrige a anterior
        </span>
      </label>

      <label className="field">
        <span className="field__label">Objetivo deste período</span>
        <textarea
          className="textarea"
          value={form.objective ?? ''}
          placeholder="Ganhar massa muscular mantendo a cintura. Subir a força no supino."
          onChange={(event) => set({ objective: event.target.value || null })}
        />
      </label>

      <div className="field">
        <span className="field__label">O peso deve</span>
        <div className="row row--wrap">
          {(Object.keys(WEIGHT_DIRECTION_LABEL) as WeightDirection[]).map((value) => (
            <button
              key={value}
              type="button"
              className={`chip ${form.weight_direction === value ? 'chip--on' : ''}`}
              onClick={() =>
                set({
                  weight_direction: form.weight_direction === value ? null : value,
                })
              }
            >
              {WEIGHT_DIRECTION_LABEL[value]}
            </button>
          ))}
        </div>
        <span className="field__hint">
          é isto que decide se uma variação de peso aparece como boa notícia
        </span>
      </div>

      <div className="grid-2">
        {numberField('Kcal', 'kcal_target')}
        <label className="field">
          <span className="field__label">Peso alvo (kg)</span>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={form.weight_target_kg ?? ''}
            onChange={(event) => set({ weight_target_kg: numberOrNull(event.target.value) })}
          />
        </label>
        {numberField('Proteína (g)', 'protein_target_g')}
        {numberField('Gordura (g)', 'fat_target_g')}
        {numberField('Hidratos (g)', 'carb_target_g')}
        {numberField('Passos', 'steps_goal')}
      </div>

      <label className="field">
        <span className="field__label">Sono (horas)</span>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          step="0.5"
          value={form.sleep_goal_hours ?? ''}
          onChange={(event) => set({ sleep_goal_hours: numberOrNull(event.target.value) })}
        />
      </label>

      <label className="field">
        <span className="field__label">Porquê esta mudança</span>
        <textarea
          className="textarea"
          value={form.notes ?? ''}
          placeholder="Subimos 200 kcal: o peso estagnou três semanas."
          onChange={(event) => set({ notes: event.target.value || null })}
        />
      </label>

      {failure && <p className="error-banner">{failure}</p>}

      <div className="row">
        <button type="button" className="btn btn--quiet" onClick={onCancel}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || !form.effective_from}
          onClick={async () => {
            setBusy(true)
            setFailure(null)
            try {
              await saveTargets(athleteId, coachId, {
                ...form,
                effective_from: form.effective_from!,
              })
              onDone()
            } catch (caught) {
              setFailure(describeError(caught))
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'A guardar…' : 'Guardar revisão'}
        </button>
      </div>

      {initial && (
        <button
          type="button"
          className="btn btn--sm btn--quiet targets__delete"
          onClick={async () => {
            await deleteTargets(initial.id)
            onDone()
          }}
        >
          Apagar esta revisão
        </button>
      )}
    </section>
  )
}
