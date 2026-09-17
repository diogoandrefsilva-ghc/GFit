import { addDays, isoDate, shortDate, weekStart } from '@/lib/format'
import './week-nav.css'

/**
 * Passar de semana em semana, com o caminho de volta ao presente sempre à
 * mão. A semana é a unidade em que se pensa o treino, e é por isso a unidade
 * do calendário — o mês só interessa a quem marca.
 */
export function WeekNav({
  monday,
  onChange,
}: {
  monday: string
  onChange: (monday: string) => void
}) {
  const current = weekStart(isoDate())
  const sunday = addDays(monday, 6)

  return (
    <div className="week-nav">
      <button
        type="button"
        className="week-nav__arrow"
        onClick={() => onChange(addDays(monday, -7))}
        aria-label="Semana anterior"
      >
        ‹
      </button>

      <span className="week-nav__text">
        <strong>
          {shortDate(monday)} – {shortDate(sunday)}
        </strong>
        {monday === current ? (
          <em>esta semana</em>
        ) : (
          <button
            type="button"
            className="week-nav__today"
            onClick={() => onChange(current)}
          >
            voltar a esta semana
          </button>
        )}
      </span>

      <button
        type="button"
        className="week-nav__arrow"
        onClick={() => onChange(addDays(monday, 7))}
        aria-label="Semana seguinte"
      >
        ›
      </button>
    </div>
  )
}
