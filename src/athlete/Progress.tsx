import { useSearchParams } from 'react-router-dom'
import { Measurements } from '@/athlete/Measurements'
import { WeeklyFeedbackScreen } from '@/athlete/WeeklyFeedback'
import './progress.css'

const ZONES = ['medidas', 'semana'] as const
type Zone = (typeof ZONES)[number]

const LABEL: Record<Zone, string> = {
  medidas: 'Medidas',
  semana: 'Feedback da semana',
}

/**
 * O progresso num separador só: as medidas, que dizem para onde o corpo vai,
 * e o feedback da semana, que diz como a semana correu. Eram dois separadores
 * numa barra de seis; juntos cabem em quatro, e são a mesma pergunta — "como
 * estou a ir?".
 *
 * A zona vive na barra de endereço (`/progresso?ver=semana`), como na área
 * "Eu" do treinador: quem sai e volta, volta ao sítio de onde saiu.
 */
export function Progress() {
  const [params, setParams] = useSearchParams()
  const asked = params.get('ver')
  const zone: Zone = ZONES.includes(asked as Zone) ? (asked as Zone) : 'medidas'

  return (
    <div className="progress">
      <nav className="progress__zones" aria-label="Progresso">
        {ZONES.map((item) => (
          <button
            key={item}
            type="button"
            className={`chip ${item === zone ? 'chip--on' : ''}`}
            aria-pressed={item === zone}
            onClick={() => setParams(item === 'medidas' ? {} : { ver: item }, { replace: true })}
          >
            {LABEL[item]}
          </button>
        ))}
      </nav>

      {zone === 'medidas' ? <Measurements /> : <WeeklyFeedbackScreen />}
    </div>
  )
}
