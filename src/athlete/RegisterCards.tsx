import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Scale } from '@/components/Scale'
import { Sheet } from '@/components/Sheet'
import { Stepper } from '@/components/Stepper'
import { TabIcon } from '@/components/TabBar'
import { hoursLabel, int, num, relativeDate } from '@/lib/format'
import type { DailyLog } from '@/lib/database.types'
import './register-cards.css'

/**
 * O registo do dia em cartões grandes: peso, passos, sono, como te sentes e
 * medidas. Cada um diz de uma vista o que já lá está — e quem não registou
 * nada vê logo o que falta, que é a pergunta que se faz ao abrir a app.
 *
 * Os cartões não registam nada: abrem o painel do costume, onde o valor fica
 * grande e sozinho. Um formulário inteiro a pedir seis coisas de uma vez é o
 * que ninguém preenche à porta do ginásio.
 */

type Which = 'peso' | 'passos' | 'sono' | 'animo'

interface Props {
  log: Partial<DailyLog>
  /** Se há gravação a decorrer — sai no cabeçalho da secção. */
  saving: boolean
  stepsGoal: number
  /** O último peso conhecido, para o painel abrir num número e não no vazio. */
  lastWeight: number | null
  weightAverage: number | null
  /** A data do último registo de perímetros, se houver. */
  measuredOn: string | null
  onPatch: (values: Partial<DailyLog>) => void
  measurementsPath: string
}

export function RegisterCards({
  log,
  saving,
  stepsGoal,
  lastWeight,
  weightAverage,
  measuredOn,
  onPatch,
  measurementsPath,
}: Props) {
  const navigate = useNavigate()
  const [open, setOpen] = useState<Which | null>(null)
  const close = () => setOpen(null)

  const weight = log.weight_kg ?? null
  const steps = log.steps ?? null
  const sleep = log.sleep_hours ?? null
  const mood = [log.energy ?? null, log.hunger ?? null, log.stress ?? null]
  const moodDone = mood.every((value) => value !== null)

  return (
    <section className="reg-block">
      <div className="card__head">
        <h2 className="reg-block__title">Registo de hoje</h2>
        <span className="reg-block__saving">{saving ? 'a guardar…' : ''}</span>
      </div>

      <div className="reg-grid">
        <Card
          icon="weight"
          label="Registar peso"
          done={weight !== null}
          value={weight !== null ? num(weight, 1) : null}
          unit="kg"
          hint={
            weightAverage !== null
              ? `média 7d ${num(weightAverage, 1)} kg`
              : lastWeight !== null
                ? `último ${num(lastWeight, 1)} kg`
                : 'em jejum, de manhã'
          }
          onClick={() => setOpen('peso')}
        />

        <Card
          icon="steps"
          label="Registar passos"
          done={steps !== null}
          value={steps !== null ? int(steps) : null}
          hint={`meta ${int(stepsGoal)}`}
          onClick={() => setOpen('passos')}
        >
          <ProgressBar value={steps ?? 0} goal={stepsGoal} />
        </Card>

        <Card
          icon="sleep"
          label="Registar sono"
          done={sleep !== null}
          value={sleep !== null ? hoursLabel(sleep) : null}
          hint="esta noite"
          onClick={() => setOpen('sono')}
        />

        <Card
          icon="mood"
          label="Registar como te sentes"
          done={moodDone}
          value={
            mood.some((value) => value !== null)
              ? mood.map((value) => value ?? '—').join(' · ')
              : null
          }
          hint="energia · fome · stress"
          onClick={() => setOpen('animo')}
        />

        <Card
          wide
          icon="ruler"
          label="Registar medidas"
          done={false}
          value={null}
          hint={
            measuredOn
              ? `perímetros · ${relativeDate(measuredOn)}`
              : 'perímetros · ainda sem registo'
          }
          onClick={() => navigate(measurementsPath)}
        />
      </div>

      {open === 'peso' && (
        <StepperSheet
          title="Peso de hoje"
          caption={weightAverage !== null ? `média 7d ${num(weightAverage, 1)} kg` : undefined}
          value={weight}
          fallback={lastWeight ?? 75}
          step={0.1}
          min={30}
          max={250}
          decimals={1}
          unit="kg"
          label="peso"
          confirm={(value) => `Registar ${num(value, 1)} kg`}
          hint="O peso diz mais em média do que dia a dia: pesa-te à mesma hora, e é a média de 7 dias que conta."
          onChange={(value) => onPatch({ weight_kg: value })}
          onClose={close}
        />
      )}

      {open === 'sono' && (
        <StepperSheet
          title="Sono desta noite"
          value={sleep}
          fallback={7.5}
          step={0.25}
          min={0}
          max={16}
          decimals={2}
          label="horas de sono"
          format={hoursLabel}
          confirm={(value) => `Registar ${hoursLabel(value)}`}
          onChange={(value) => onPatch({ sleep_hours: value })}
          onClose={close}
        />
      )}

      {open === 'passos' && (
        <StepsSheet
          value={steps}
          goal={stepsGoal}
          onChange={(value) => onPatch({ steps: value })}
          onClose={close}
        />
      )}

      {open === 'animo' && (
        <MoodSheet log={log} onChange={onPatch} onClose={close} />
      )}
    </section>
  )
}

/* ── o cartão ──────────────────────────────────────────── */

function Card({
  icon,
  label,
  value,
  unit,
  hint,
  done,
  wide,
  children,
  onClick,
}: {
  icon: IconName
  label: string
  value: string | null
  unit?: string
  hint?: string
  done: boolean
  wide?: boolean
  children?: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`reg ${wide ? 'reg--wide' : ''} ${done ? 'reg--done' : ''}`}
      onClick={onClick}
      aria-label={value ? `${label}. Hoje ${value}${unit ? ` ${unit}` : ''}.` : label}
    >
      <span className="reg__top">
        <span className="reg__icon">
          <RegIcon name={icon} />
        </span>
        {done && (
          <span className="reg__tick" aria-hidden="true">
            ✓
          </span>
        )}
      </span>
      <span className="reg__body">
        <span className="reg__label">{label}</span>
        {value !== null ? (
          <span className="reg__value">
            {value}
            {unit && <em className="reg__unit">{unit}</em>}
          </span>
        ) : (
          !wide && <span className="reg__value reg__value--empty">por registar</span>
        )}
        {hint && <span className="reg__hint">{hint}</span>}
      </span>
      {children}
      {wide && (
        <span className="reg__chevron" aria-hidden="true">
          ›
        </span>
      )}
    </button>
  )
}

function ProgressBar({ value, goal }: { value: number; goal: number }) {
  return (
    <span className="reg__bar" aria-hidden="true">
      <i style={{ width: `${Math.min(100, (value / Math.max(goal, 1)) * 100)}%` }} />
    </span>
  )
}

/* ── os painéis ────────────────────────────────────────── */

/**
 * Peso e sono: um número só, com − e +. Enquanto não há nada registado, o
 * contador abre no último valor conhecido e há um botão a confirmá-lo — quem
 * pesa o mesmo de ontem sai daqui num toque.
 */
function StepperSheet({
  title,
  caption,
  value,
  fallback,
  step,
  min,
  max,
  decimals,
  unit,
  label,
  format,
  confirm,
  hint,
  onChange,
  onClose,
}: {
  title: string
  caption?: string
  value: number | null
  fallback: number
  step: number
  min: number
  max: number
  decimals: number
  unit?: string
  label: string
  format?: (value: number) => string
  confirm: (value: number) => string
  hint?: string
  onChange: (value: number) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<number | null>(value)

  /* Só se grava à saída: a fila de − e + de quem procura o número certo não
     tem de ser uma fila de gravações. */
  function close() {
    if (draft !== null && draft !== value) onChange(draft)
    onClose()
  }

  return (
    <Sheet title={title} caption={caption} onClose={close}>
      <div className="reg-sheet__dial">
        <Stepper
          value={draft}
          fallback={fallback}
          onChange={setDraft}
          step={step}
          min={min}
          max={max}
          decimals={decimals}
          unit={unit}
          format={format}
          size="lg"
          label={label}
        />
      </div>
      {draft === null && (
        <button
          type="button"
          className="btn btn--accent btn--block"
          onClick={() => {
            onChange(fallback)
            onClose()
          }}
        >
          {confirm(fallback)}
        </button>
      )}
      {hint && <p className="reg-sheet__hint">{hint}</p>}
    </Sheet>
  )
}

function StepsSheet({
  value,
  goal,
  onChange,
  onClose,
}: {
  value: number | null
  goal: number
  onChange: (value: number | null) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState<number | null>(value)

  function close() {
    if (draft !== value) onChange(draft)
    onClose()
  }

  const left = goal - (draft ?? 0)

  return (
    <Sheet title="Passos de hoje" caption={`meta ${int(goal)}`} onClose={close}>
      <input
        className="input reg-sheet__input"
        type="number"
        inputMode="numeric"
        min={0}
        max={80000}
        placeholder="0"
        autoFocus
        value={draft ?? ''}
        onChange={(event) =>
          setDraft(event.target.value === '' ? null : Number(event.target.value))
        }
      />
      <ProgressBar value={draft ?? 0} goal={goal} />
      <p className="reg-sheet__hint">
        {draft === null
          ? 'O telemóvel já os conta — é copiar o número da app de saúde.'
          : left > 0
            ? `Faltam ${int(left)} passos para a meta.`
            : 'Meta cumprida.'}
      </p>
    </Sheet>
  )
}

/** As três escalas de uma vez: são a mesma pergunta feita de três maneiras. */
function MoodSheet({
  log,
  onChange,
  onClose,
}: {
  log: Partial<DailyLog>
  onChange: (values: Partial<DailyLog>) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState({
    energy: log.energy ?? null,
    hunger: log.hunger ?? null,
    stress: log.stress ?? null,
  })

  function close() {
    const changed =
      draft.energy !== (log.energy ?? null) ||
      draft.hunger !== (log.hunger ?? null) ||
      draft.stress !== (log.stress ?? null)
    if (changed) onChange(draft)
    onClose()
  }

  return (
    <Sheet title="Como te sentes" onClose={close}>
      <Scale
        label="Energia"
        hint="1 sem pilha · 5 a abarrotar"
        value={draft.energy}
        onChange={(value) => setDraft((current) => ({ ...current, energy: value }))}
      />
      <Scale
        label="Fome"
        hint="1 nenhuma · 5 muita"
        value={draft.hunger}
        onChange={(value) => setDraft((current) => ({ ...current, hunger: value }))}
      />
      <Scale
        label="Stress"
        hint="1 calmo · 5 em brasa"
        value={draft.stress}
        onChange={(value) => setDraft((current) => ({ ...current, stress: value }))}
      />
    </Sheet>
  )
}

/* ── os desenhos ───────────────────────────────────────── */

type IconName = 'weight' | 'steps' | 'sleep' | 'mood' | 'ruler'

/**
 * O das medidas é o mesmo do separador para onde o cartão leva: quem toca
 * aqui reconhece onde aterrou.
 */
function RegIcon({ name }: { name: IconName }) {
  if (name === 'ruler') return <TabIcon name="ruler" />

  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'weight':
      return (
        <svg {...common}>
          <rect x="3" y="4.5" width="18" height="15" rx="4" />
          <path d="M8 15a4 4 0 0 1 8 0M12 15l2.6-2.8" />
        </svg>
      )
    case 'steps':
      return (
        <svg {...common}>
          <path d="M6.6 3.8c1.3 0 2 1.3 2 3 0 1.5-.5 2.5-.5 3.6 0 .9.4 1.6.4 2.4 0 1.2-.7 1.8-1.9 1.8s-1.9-.6-1.9-1.8c0-.8.4-1.5.4-2.4 0-1.1-.5-2.1-.5-3.6 0-1.7.7-3 2-3Z" />
          <path d="M17.4 8.4c1.3 0 2 1.3 2 3 0 1.5-.5 2.5-.5 3.6 0 .9.4 1.6.4 2.4 0 1.2-.7 1.8-1.9 1.8s-1.9-.6-1.9-1.8c0-.8.4-1.5.4-2.4 0-1.1-.5-2.1-.5-3.6 0-1.7.7-3 2-3Z" />
        </svg>
      )
    case 'sleep':
      return (
        <svg {...common}>
          <path d="M20.2 14.8A8.4 8.4 0 0 1 9.2 3.8a8.4 8.4 0 1 0 11 11Z" />
        </svg>
      )
    case 'mood':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.6" />
          <path d="M9.2 10h.01M14.8 10h.01M8.4 14.2a4.6 4.6 0 0 0 7.2 0" />
        </svg>
      )
  }
}
