const WEEKDAYS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const MONTHS = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
]

/** Data local em ISO (YYYY-MM-DD), sem passar por UTC. */
export function isoDate(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseIso(value: string): Date {
  const [y, m, d] = value.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function addDays(value: string, days: number): string {
  const date = parseIso(value)
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

/** Segunda-feira da semana a que a data pertence. */
export function weekStart(value: string = isoDate()): string {
  const date = parseIso(value)
  const shift = (date.getDay() + 6) % 7
  date.setDate(date.getDate() - shift)
  return isoDate(date)
}

export function daysBetween(from: string, to: string): number {
  const ms = parseIso(to).getTime() - parseIso(from).getTime()
  return Math.round(ms / 86_400_000)
}

/** "Terça, 15 set" */
export function longDate(value: string = isoDate()): string {
  const date = parseIso(value)
  const day = WEEKDAYS[date.getDay()]
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

/** "15 set" */
export function shortDate(value: string): string {
  const date = parseIso(value)
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`
}

export function relativeDate(value: string): string {
  const diff = daysBetween(value, isoDate())
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'ontem'
  if (diff < 0) return shortDate(value)
  if (diff < 7) return `há ${diff} dias`
  if (diff < 14) return 'há 1 semana'
  if (diff < 31) return `há ${Math.floor(diff / 7)} semanas`
  return shortDate(value)
}

/** Vírgula decimal, como se escreve em português. */
export function num(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(decimals).replace('.', ',')
}

/** Inteiro com espaço a separar milhares: "7 240". */
export function int(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  // O pt-PT separa milhares com espaço inquebrável (por vezes o estreito);
  // aqui queremos um espaço normal.
  return Math.round(value)
    .toLocaleString('pt-PT')
    .replace(/[\u00a0\u202f]/g, ' ')
}

/** Diferença com sinal sempre à vista: "+1,9" / "−0,6". */
export function signed(value: number | null | undefined, decimals = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (Math.abs(value) < 0.05 ** decimals) return num(0, decimals)
  const sign = value > 0 ? '+' : '−'
  return `${sign}${num(Math.abs(value), decimals)}`
}

/** 7.33 → "7h 20" */
export function hoursLabel(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const hours = Math.floor(value)
  const minutes = Math.round((value - hours) * 60)
  return minutes === 0 ? `${hours}h` : `${hours}h ${String(minutes).padStart(2, '0')}`
}

/** Segundos → "24:16" */
export function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/** Minúsculas sem acentos, igual a gfit.norm() no Postgres. */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function repRange(min: number | null, max: number | null): string {
  if (min && max) return min === max ? `${min}` : `${min}-${max}`
  if (min) return `${min}+`
  if (max) return `até ${max}`
  return '—'
}

export function restLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = seconds / 60
  return Number.isInteger(minutes) ? `${minutes}min` : `${seconds}s`
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}
