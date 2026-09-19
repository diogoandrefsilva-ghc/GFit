import { useSearchParams } from 'react-router-dom'
import { Measurements } from '@/athlete/Measurements'
import { Today } from '@/athlete/Today'
import { WorkoutHome } from '@/athlete/WorkoutHome'
import { ScreenHeader } from '@/components/Screen'
import { SelfFicha } from '@/shared/SelfFicha'
import { SELF_ZONES, type SelfZone } from '@/lib/routes'
import './self-area.css'

const LABEL: Record<SelfZone, string> = {
  hoje: 'Hoje',
  treino: 'Treino',
  medidas: 'Medidas',
  ficha: 'Ficha e metas',
}

/**
 * O treinador como aluno dele próprio. Não há ecrãs novos: são os mesmos que o
 * aluno usa, e funcionam tal e qual porque para a base de dados o treinador é
 * um aluno que é o seu próprio treinador — o `athlete_id` destes registos é o
 * dele.
 *
 * A zona vive na barra de endereço (`/eu?zona=treino`) e não em estado local:
 * quem sai para um treino e volta, volta ao sítio de onde saiu.
 */
export function SelfArea() {
  const [params, setParams] = useSearchParams()
  const asked = params.get('zona')
  const zone: SelfZone = SELF_ZONES.includes(asked as SelfZone)
    ? (asked as SelfZone)
    : 'hoje'

  return (
    <div className="self">
      <nav className="self__zones" aria-label="A minha área">
        {SELF_ZONES.map((item) => (
          <button
            key={item}
            type="button"
            className={`chip ${item === zone ? 'chip--on' : ''}`}
            onClick={() => setParams({ zona: item }, { replace: true })}
          >
            {LABEL[item]}
          </button>
        ))}
      </nav>

      {zone === 'hoje' && <Today />}
      {zone === 'treino' && <WorkoutHome />}
      {zone === 'medidas' && <Measurements />}
      {zone === 'ficha' && (
        <div className="screen">
          <ScreenHeader
            title="A minha ficha"
            subtitle="O mesmo que registas de um aluno, para ti: objectivo, metas, limitações e notas."
          />
          <SelfFicha />
        </div>
      )}
    </div>
  )
}
