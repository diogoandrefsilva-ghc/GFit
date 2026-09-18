import { useMemo } from 'react'
import type { CSSProperties } from 'react'
import raw from '@/assets/corpo-gfit.svg?raw'
import './body-map.css'

export type BodyView = 'front' | 'back'
export type BodySex = 'M' | 'F' | null | undefined

/**
 * Os 15 grupos desenhados no `corpo-gfit.svg`. São, de propósito, exactamente
 * os slugs da tabela `gfit.muscles`: o que o exercício diz que trabalha é o
 * que o corpo acende, sem tabela de conversão pelo meio.
 */
export const BODY_MUSCLES = [
  'abs',
  'adutores',
  'biceps',
  'dorsal',
  'gemeos',
  'gluteo',
  'lombares',
  'ombro_frontal',
  'ombro_medio',
  'ombro_posterior',
  'peito',
  'posterior_de_coxa',
  'quadriceps',
  'trapezio',
  'triceps',
] as const

/** As duas vistas vivem no mesmo ficheiro, nas mesmas coordenadas locais. */
const VIEW_BOX = '-10 0 220 460'

let views: Record<BodyView, string> | null = null

/**
 * O SVG entra como texto e é partido uma vez nas duas vistas. Tem de ficar
 * inline no DOM — com `<img src>` o CSS da app não lhe chegava e não havia
 * como pintar nada.
 */
function markup(view: BodyView): string {
  if (!views) {
    const doc = new DOMParser().parseFromString(raw, 'image/svg+xml')
    const inner = (id: string) =>
      doc.querySelector(`[id="${id}"]`)?.innerHTML ?? ''
    views = { front: inner('body-front'), back: inner('body-back') }
  }
  return views[view]
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
              const group = (event.target as Element).closest?.('[data-muscle]')
              const slug = group?.getAttribute('data-muscle')
              if (slug) onPick(slug)
            }
          : undefined
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
