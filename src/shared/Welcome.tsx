import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth, useProfile, useTrainsAlone } from '@/auth/useAuth'
import { Logo } from '@/components/Logo'
import { TabIcon, type Tab } from '@/components/TabBar'
import { forgetTour, hasSeenTour, markTourSeen } from '@/lib/tour'
import './welcome.css'

interface Slide {
  /** O símbolo do separador de que o cartão fala; o primeiro traz a marca. */
  icon: Tab['icon'] | 'brand'
  eyebrow: string
  title: string
  body: ReactNode
}

/**
 * A apresentação da app, no primeiro arranque de cada um.
 *
 * Não é um passeio pela interface com setas a apontar: são meia dúzia de
 * cartões que dizem o que a app faz e onde é que isso vive, com o símbolo de
 * cada separador ao lado do texto. Quem não quer, salta — e quem saltou pode
 * rever no Perfil.
 *
 * O conteúdo muda com quem está a ver: o treinador não tem "Semana" para
 * responder, e quem treina por sua conta escreve o plano em vez de o receber.
 */
export function Welcome({
  mode = 'first-run',
  onClose,
}: {
  mode?: 'first-run' | 'review'
  onClose: () => void
}) {
  const profile = useProfile()
  const { isCoach } = useAuth()
  const alone = useTrainsAlone()

  const slides = useMemo(
    () => (isCoach ? coachSlides() : athleteSlides(alone)),
    [isCoach, alone],
  )

  const card = useRef<HTMLDivElement>(null)
  const [at, setAt] = useState(0)
  // Na primeira vez a caixa vem marcada: a apresentação é para ver uma vez.
  // Ao rever, mostra o que está guardado — desmarcá-la traz o ecrã de volta.
  const [remember, setRemember] = useState(() =>
    mode === 'review' ? hasSeenTour(profile.id) : true,
  )

  const last = at === slides.length - 1

  function finish() {
    if (remember) markTourSeen(profile.id)
    else forgetTour(profile.id)
    onClose()
  }

  // A página por baixo não desliza enquanto isto está à frente, e o foco entra
  // no cartão: quem navega por teclado ou leitor de ecrã fica onde está a ler,
  // e não na app que ficou por trás.
  useEffect(() => {
    card.current?.focus({ preventScroll: true })

    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  // Sem lista de dependências de propósito: o Escape tem de fechar com a
  // escolha da caixa como ela está agora, e não como estava ao montar.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') finish()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  // Num ecrã curto o cartão desliza; ao mudar de página volta ao princípio.
  useEffect(() => {
    card.current?.scrollTo({ top: 0 })
  }, [at])

  const slide = slides[at]

  return (
    <div
      className="welcome"
      role="dialog"
      aria-modal="true"
      aria-label="Apresentação da GFit"
    >
      <div className="welcome__card" ref={card} tabIndex={-1}>
        <div className="welcome__top">
          <span className="welcome__count">
            {at + 1} / {slides.length}
          </span>
          {/* Na última página o botão grande já diz "Começar": dois caminhos
              para a mesma porta só fazem hesitar. */}
          {!last && (
            <button type="button" className="welcome__skip" onClick={finish}>
              Saltar
            </button>
          )}
        </div>

        <div className="welcome__slide" key={at} aria-live="polite">
          <span className="welcome__icon">
            {slide.icon === 'brand' ? (
              <Logo size={40} />
            ) : (
              <TabIcon name={slide.icon} />
            )}
          </span>
          <p className="eyebrow">{slide.eyebrow}</p>
          <h2 className="welcome__title">{slide.title}</h2>
          <p className="welcome__body">{slide.body}</p>
        </div>

        <div className="welcome__dots" aria-hidden="true">
          {slides.map((each, index) => (
            <span
              key={each.title}
              className={`welcome__dot ${index === at ? 'is-on' : ''}`}
            />
          ))}
        </div>

        <div className="welcome__actions">
          {at > 0 && (
            <button
              type="button"
              className="btn btn--quiet"
              onClick={() => setAt(at - 1)}
            >
              Anterior
            </button>
          )}
          <button
            type="button"
            className="btn btn--accent welcome__next"
            onClick={() => (last ? finish() : setAt(at + 1))}
          >
            {last ? 'Começar' : 'Seguinte'}
          </button>
        </div>

        <label className="welcome__again">
          <input
            type="checkbox"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <span>Não voltar a mostrar ao abrir a app</span>
        </label>
      </div>
    </div>
  )
}

/**
 * O aluno. `alone` é quem treina por sua conta: recebe os mesmos ecrãs, mas o
 * plano é escrito por ele e não há ninguém do outro lado do feedback — ainda.
 */
function athleteSlides(alone: boolean): Slide[] {
  return [
    {
      icon: 'brand',
      eyebrow: 'Bem-vindo',
      title: 'Isto é a GFit',
      body: alone
        ? 'Treinas por tua conta: escreves o teu plano, registas o que fazes no ginásio e acompanhas o peso e as medidas ao longo das semanas. Se um treinador te convidar com o teu email, ficas ligado a ele sem perderes nada do que já registaste.'
        : 'O teu treinador escreve os treinos e a dieta; tu registas o que fazes. Tudo o que escreves aqui chega-lhe, e é com isso que ele decide a semana seguinte. Um minuto a dizer onde está cada coisa.',
    },
    {
      icon: 'today',
      eyebrow: 'Separador Hoje',
      title: 'O dia começa aqui',
      body: 'O treino de hoje e o registo do dia: peso, passos, sono, energia, fome e stress. São poucos toques, e é o que faz a diferença entre um plano às cegas e um plano com números.',
    },
    {
      icon: 'workout',
      eyebrow: 'Separador Treino',
      title: 'Série a série',
      body: alone
        ? 'Escreves o plano a partir da base de exercícios, marca-lo nos dias que quiseres e depois registas cada série — carga, repetições e reps em reserva — com o que fizeste da última vez ao lado. Nos treinos por tempo, a app conta o tempo por ti.'
        : 'A semana que o treinador marcou. Dentro do treino registas cada série — carga, repetições e reps em reserva — com o que fizeste da última vez já ao lado, para saberes o que tens de bater. Nos treinos por tempo, a app conduz com temporizador.',
    },
    {
      icon: 'plate',
      eyebrow: 'Dieta e Medidas',
      title: 'O resto da semana',
      body: 'A dieta mostra as refeições do plano com as calorias e os macros a que te propuseste. Em Medidas ficam os perímetros e o peso, com o gráfico ao lado: interessa o caminho, não o número de hoje.',
    },
    {
      icon: 'week',
      eyebrow: 'Separador Semana',
      title: 'Fechar a semana',
      body: alone
        ? 'No fim da semana respondes a quatro perguntas sobre o que correu bem e o que custou. Fica o registo — e no dia em que tiveres treinador, é a primeira coisa que ele lê.'
        : 'No fim da semana respondes a quatro perguntas sobre o que correu bem e o que custou. O treinador lê-as e responde-te aí mesmo.',
    },
    {
      icon: 'person',
      eyebrow: 'Já está',
      title: 'Leva-a no bolso',
      body: (
        <>
          Instala a app no telemóvel — no iPhone, <strong>Partilhar →
          Adicionar ao ecrã principal</strong>; no Android, <strong>Instalar
          aplicação</strong> no menu do browser. Guarda o que já abriste, para
          o ginásio onde a rede não chega. Esta apresentação fica no{' '}
          <strong>Perfil</strong>, se a quiseres rever.
        </>
      ),
    },
  ]
}

function coachSlides(): Slide[] {
  return [
    {
      icon: 'brand',
      eyebrow: 'Bem-vindo',
      title: 'Isto é a GFit',
      body: 'É a tua planilha, sem a planilha: os planos de treino e as dietas que escreves chegam ao telemóvel do aluno, e o que ele regista — séries, peso, sono, feedback — volta para aqui. Um minuto a dizer onde está cada coisa.',
    },
    {
      icon: 'people',
      eyebrow: 'Início e Alunos',
      title: 'Quem precisa de ti',
      body: 'O Início junta o que não pode esperar: quem não treina há dias, o feedback por responder, os planos a acabar. Em Alunos entras na ficha de cada um — medidas, treinos, metas, limitações e as notas que lhe deixas.',
    },
    {
      icon: 'library',
      eyebrow: 'Planos e Exercícios',
      title: 'Escrever o treino',
      body: 'O plano monta-se a partir da base de exercícios — quase trezentos, a maior parte com vídeo —, publica-se e marca-se no calendário. Enquanto não o publicas, é um rascunho que só tu vês.',
    },
    {
      icon: 'plate',
      eyebrow: 'Dieta',
      title: 'Montar o plano alimentar',
      body: 'As refeições saem da base de alimentos e as calorias e os macros vão-se somando enquanto escreves, contra as metas que puseste ao aluno. Sabes se fechaste a conta antes de publicares.',
    },
    {
      icon: 'workout',
      eyebrow: 'Separador Eu',
      title: 'Também treinas',
      body: 'O separador Eu é o teu lado de aluno: o teu dia, os teus treinos, as tuas medidas e as metas que pões a ti próprio. Os mesmos ecrãs que os teus alunos usam.',
    },
    {
      icon: 'person',
      eyebrow: 'Já está',
      title: 'Convidar quem falta',
      body: (
        <>
          Os alunos entram por convite, no <strong>Perfil</strong>. A app não
          envia emails — cria o convite e dá-te o texto para enviares por onde
          quiseres. É também no Perfil que esta apresentação fica, se a
          quiseres rever.
        </>
      ),
    },
  ]
}

/**
 * A primeira vez. Decide-se aqui, e não dentro da apresentação, para que o
 * ecrã só se monte a quem ainda não o viu.
 */
export function WelcomeGate() {
  const profile = useProfile()
  const [open, setOpen] = useState(() => !hasSeenTour(profile.id))

  if (!open) return null
  return <Welcome onClose={() => setOpen(false)} />
}
