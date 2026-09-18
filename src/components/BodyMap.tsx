import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import {
  BODY_MUSCLES,
  VIEW_BOX,
  markup,
  type BodySex,
  type BodyView,
} from '@/lib/body'
import './body-map.css'

/**
 * Folga do toque, em unidades do desenho (o viewBox tem 220 de largura). Num
 * telemóvel o corpo fica com uns 160 px, e aí um deltóide não chega a 10 px de
 * lado — bem abaixo do que um polegar acerta. Um toque que caia ao lado apanha
 * o músculo mais próximo dentro desta distância; mais longe não apanha nada,
 * para tocar fora do corpo continuar a não fazer nada.
 */
const SNAP = 10

/** Que músculo é que este ponto do ecrã quer dizer. */
function muscleAt(svg: SVGSVGElement, clientX: number, clientY: number): string | null {
  const direct = document.elementFromPoint(clientX, clientY)?.closest?.('[data-muscle]')
  if (direct) return direct.getAttribute('data-muscle')

  const ctm = svg.getScreenCTM()
  if (!ctm) return null
  const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())

  let nearest: string | null = null
  let shortest = SNAP
  for (const group of svg.querySelectorAll<SVGGraphicsElement>('[data-muscle]')) {
    // Lado a lado, e não o grupo inteiro: a caixa de um grupo com esquerdo e
    // direito abrange o vão do meio e monta-se por cima da dos vizinhos — pelo
    // esterno, o peito perdia para o deltóide, que nem ali está.
    for (const shape of group.querySelectorAll<SVGGraphicsElement>('path')) {
      const box = shape.getBBox()
      // A silhueta que não está a ser mostrada não tem caixa; ignora-se, senão
      // ficava um alvo fantasma na origem do desenho.
      if (box.width === 0 && box.height === 0) continue
      const dx = Math.max(box.x - point.x, 0, point.x - (box.x + box.width))
      const dy = Math.max(box.y - point.y, 0, point.y - (box.y + box.height))
      const distance = Math.hypot(dx, dy)
      if (distance < shortest) {
        shortest = distance
        nearest = group.getAttribute('data-muscle')
      }
    }
  }
  return nearest
}

interface Props {
  view: BodyView
  /** Slug → intensidade, de 0 a 1. O que não vier fica no traço neutro. */
  intensities: Map<string, number>
  /** A silhueta segue o sexo da ficha; sem ficha, fica a masculina. */
  sex?: BodySex
  /** Abaixo de ~140 px de largura: engrossa o traço e esconde o detalhe. */
  small?: boolean
  label?: string
  onPick?: (slug: string) => void
}

/**
 * Uma vista do corpo com os grupos musculares pintados por intensidade.
 * A intensidade viaja em variáveis CSS no contentor (`--bm-<slug>`), o que
 * deixa o React fora do DOM do SVG e mantém a transição de cor a funcionar.
 */
export function BodyMap({
  view,
  intensities,
  sex,
  small = false,
  label,
  onPick,
}: Props) {
  const html = useMemo(() => markup(view), [view])

  const style = useMemo(() => {
    const vars: Record<string, string> = {}
    for (const slug of BODY_MUSCLES) {
      const value = intensities.get(slug)
      if (value) vars[`--bm-${slug}`] = String(Math.min(1, Math.max(0, value)))
    }
    return vars as CSSProperties
  }, [intensities])

  const className = [
    'body-map',
    sex === 'F' ? 'body-map--fem' : '',
    small ? 'body-map--sm' : '',
    onPick ? 'body-map--pickable' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <svg
      className={className}
      style={style}
      viewBox={VIEW_BOX}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label ?? (view === 'front' ? 'Corpo de frente' : 'Corpo de costas')}
      onClick={
        onPick
          ? (event) => {
              const slug = muscleAt(event.currentTarget, event.clientX, event.clientY)
              if (slug) onPick(slug)
            }
          : undefined
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
