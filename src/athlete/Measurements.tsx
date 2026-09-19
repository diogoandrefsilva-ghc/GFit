import { useState } from 'react'
import { useAuth, useProfile, useTrainsAlone } from '@/auth/useAuth'
import { Loading, ScreenHeader, Stat } from '@/components/Screen'
import { Sparkline } from '@/components/Sparkline'
import { SelfFicha } from '@/shared/SelfFicha'
import { supabase } from '@/lib/supabase'
import {
  fetchAthleteProfile,
  fetchCurrentTargets,
  fetchMeasurements,
  fetchRecentLogs,
} from '@/lib/api'
import { WEIGHT_DIRECTION_LABEL, rollingAverage, weightTone } from '@/lib/calc'
import { isoDate, num, shortDate, signed } from '@/lib/format'
import { unwrap, useQuery } from '@/lib/useQuery'
import type { Measurement } from '@/lib/database.types'
import './measurements.css'

/** Os campos de perímetros, na mesma ordem da folha "Perimetros". */
const PERIMETERS = [
  { key: 'waist_cm', label: 'Cintura' },
  { key: 'glute_cm', label: 'Glúteo' },
  { key: 'chest_cm', label: 'Peito' },
  { key: 'thigh_r_cm', label: 'Coxa drt.' },
  { key: 'thigh_l_cm', label: 'Coxa esq.' },
  { key: 'arm_r_cm', label: 'Braço drt.' },
  { key: 'arm_l_cm', label: 'Braço esq.' },
  { key: 'calf_r_cm', label: 'Gémeo drt.' },
  { key: 'calf_l_cm', label: 'Gémeo esq.' },
] as const

type PerimeterKey = (typeof PERIMETERS)[number]['key']

export function Measurements() {
  const profile = useProfile()
  const { isCoach } = useAuth()
  // O aluno sem treinador não tem quem lhe preencha a ficha nem quem lhe ponha
  // metas: fica aqui, ao pé das medidas, que é o que a ficha explica. Na área
  // do treinador isto vive na sua própria zona, e não se repete.
  const ownFicha = useTrainsAlone() && !isCoach
  const [adding, setAdding] = useState(false)

  const { data, loading, error, reload } = useQuery(
    ['medidas', profile.id],
    async () => {
      const [logs, measurements, athlete, targets] = await Promise.all([
        fetchRecentLogs(profile.id, 120),
        fetchMeasurements(profile.id),
        fetchAthleteProfile(profile.id),
        fetchCurrentTargets(profile.id),
      ])
      return { logs, measurements, athlete, targets }
    },
  )

  if (loading) return <Loading label="A carregar medidas" />
  if (error) {
    return (
      <div className="screen">
        <p className="error-banner">{error}</p>
      </div>
    )
  }

  const { logs, measurements, athlete, targets } = data!
  const weights = logs.map((log) => log.weight_kg)
  const average = rollingAverage(weights, 7)
  const present = weights.filter((value): value is number => value !== null)

  const latest = measurements[0] ?? null
  const earlier = measurements[1] ?? null

  const totalChange =
    present.length > 1 ? present[present.length - 1] - present[0] : null

  return (
    <div className="screen">
      <ScreenHeader
        title="Medidas"
        subtitle={
          athlete?.next_update_date
            ? `Próxima atualização ${shortDate(athlete.next_update_date)}`
            : undefined
        }
      />

      <section className="card">
        <div className="card__head">
          <span className="eyebrow">Peso · últimas semanas</span>
          <strong className="measure__weight">
            {present.length ? `${num(present[present.length - 1], 1)} kg` : '—'}
          </strong>
        </div>
        <Sparkline values={weights} overlay={average} label="Evolução do peso" />
        <div className="row">
          <Stat
            label="Variação"
            value={totalChange !== null ? `${signed(totalChange)} kg` : '—'}
            hint={
              targets?.weight_direction
                ? WEIGHT_DIRECTION_LABEL[targets.weight_direction].toLowerCase()
                : 'desde o primeiro registo'
            }
            tone={weightTone(totalChange, targets?.weight_direction)}
          />
          <Stat
            label="Média 7d"
            value={
              average.length ? `${num(average[average.length - 1] ?? null, 1)} kg` : '—'
            }
            hint="linha laranja"
          />
        </div>
      </section>

      <section className="card">
        <div className="card__head">
          <span className="eyebrow">
            Perímetros{latest ? ` · ${shortDate(latest.measured_on)}` : ''}
          </span>
          <button
            type="button"
            className="btn btn--sm btn--quiet"
            onClick={() => setAdding((value) => !value)}
          >
            {adding ? 'Fechar' : '+ Novo registo'}
          </button>
        </div>

        {latest ? (
          <ul className="perimeters">
            {PERIMETERS.map((field) => {
              const value = latest[field.key]
              if (value === null) return null
              const before = earlier?.[field.key] ?? null
              const diff = before !== null ? Number(value) - Number(before) : null
              return (
                <li key={field.key} className="perimeter">
                  <span className="perimeter__label">{field.label}</span>
                  <strong className="perimeter__value">{num(value, 1)} cm</strong>
                  {diff !== null && (
                    <span className="perimeter__diff">
                      {signed(diff)}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="subtitle">Ainda sem perímetros registados.</p>
        )}

        {adding && (
          <PerimeterForm
            athleteId={profile.id}
            previous={latest}
            onSaved={() => {
              setAdding(false)
              reload()
            }}
          />
        )}
      </section>

      {ownFicha && <SelfFicha />}

      {measurements.length > 1 && (
        <section className="card card--flat">
          <span className="eyebrow">Histórico</span>
          <ul className="measure-history">
            {measurements.slice(0, 8).map((entry) => (
              <li key={entry.id}>
                <span>{shortDate(entry.measured_on)}</span>
                <span className="muted">
                  {entry.weight_kg ? `${num(entry.weight_kg, 1)} kg` : '—'}
                </span>
                <span className="muted">
                  {entry.waist_cm ? `cintura ${num(entry.waist_cm, 1)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function PerimeterForm({
  athleteId,
  previous,
  onSaved,
}: {
  athleteId: string
  previous: Measurement | null
  onSaved: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [weight, setWeight] = useState('')
  const [date, setDate] = useState(isoDate())
  const [saving, setSaving] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setFailure(null)
    try {
      const payload: Record<string, number | string | null> = {
        athlete_id: athleteId,
        measured_on: date,
        weight_kg: weight === '' ? null : Number(weight),
      }
      for (const field of PERIMETERS) {
        const raw = values[field.key]
        payload[field.key] = raw === undefined || raw === '' ? null : Number(raw)
      }
      unwrap(
        await supabase
          .from('measurements')
          .upsert(payload as never, { onConflict: 'athlete_id,measured_on' })
          .select(),
      )
      onSaved()
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : String(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="perimeter-form">
      <label className="field">
        <span className="field__label">Data</span>
        <input
          className="input"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field__label">Peso (kg)</span>
        <input
          className="input"
          type="number"
          inputMode="decimal"
          step="0.1"
          value={weight}
          placeholder={previous?.weight_kg ? num(previous.weight_kg, 1) : ''}
          onChange={(event) => setWeight(event.target.value)}
        />
      </label>

      <div className="grid-2">
        {PERIMETERS.map((field) => (
          <label className="field" key={field.key}>
            <span className="field__label">{field.label}</span>
            <input
              className="input"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder={
                previous?.[field.key] ? num(previous[field.key], 1) : 'cm'
              }
              value={values[field.key] ?? ''}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.key as PerimeterKey]: event.target.value,
                }))
              }
            />
          </label>
        ))}
      </div>

      {failure && <p className="error-banner">{failure}</p>}

      <button
        type="button"
        className="btn btn--primary btn--block"
        onClick={save}
        disabled={saving}
      >
        {saving ? 'A guardar…' : 'Guardar medidas'}
      </button>
    </div>
  )
}
