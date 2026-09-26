import { useSyncExternalStore } from 'react'

/**
 * O tema da app: cores, letra e forma, escolhidos no Perfil.
 *
 * Fica no dispositivo e não no perfil, como a apresentação (`tour.ts`): o tema
 * tem de estar posto antes do primeiro desenho, e o `index.html` lê-o do
 * `localStorage` antes de haver sessão ou rede. Quem tem a app em dois
 * telemóveis escolhe nos dois.
 *
 * Um tema é duas coisas. O `look` é a forma — Papel, Caderno ou Arena — e vive
 * em `themes.css`. As cores vivem em `tokens.css`, por `id`. O Guerreiro é a
 * forma da Arena com as cores e o logótipo do Guerreiro Personal Trainer.
 */

export type ThemeId = 'papel' | 'caderno' | 'arena' | 'guerreiro'
export type Look = 'papel' | 'caderno' | 'arena'

export interface Theme {
  id: ThemeId
  name: string
  hint: string
  look: Look
  /** A cor da barra do browser e do sistema (`theme-color`). */
  chrome: string
  /** Fundo, cartão e marca: o que o cartão de escolha mostra. */
  swatches: [string, string, string]
}

export const THEMES: Theme[] = [
  {
    id: 'papel',
    name: 'Papel',
    hint: 'O de sempre: papel, tinta e dourado.',
    look: 'papel',
    chrome: '#16150F',
    swatches: ['#f4f1ec', '#ffffff', '#e3b04b'],
  },
  {
    id: 'caderno',
    name: 'Caderno',
    hint: 'Claro e editorial, números com serifa.',
    look: 'caderno',
    chrome: '#FBFAF6',
    swatches: ['#fbfaf6', '#141310', '#e3b04b'],
  },
  {
    id: 'arena',
    name: 'Arena',
    hint: 'Preto e dourado, letra de placar.',
    look: 'arena',
    chrome: '#0C0B09',
    swatches: ['#0c0b09', '#17150f', '#e3b04b'],
  },
  {
    id: 'guerreiro',
    name: 'Guerreiro',
    hint: 'Preto e verde, com o logótipo do Guerreiro.',
    look: 'arena',
    chrome: '#0A0A0A',
    swatches: ['#0a0a0a', '#151515', '#7ee04e'],
  },
]

const DEFAULT: ThemeId = 'papel'

/** A mesma chave que o `index.html` lê antes de a app arrancar. */
const KEY = 'gfit.tema'

/**
 * As letras de cada forma. A Archivo do Papel já vem no `index.html`; as
 * outras só se descarregam para quem as escolhe.
 */
const FONTS: Record<Look, string | null> = {
  papel: null,
  caderno:
    'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Schibsted+Grotesk:wght@400;500;600;700;800&display=swap',
  arena:
    'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700&display=swap',
}

/** O `localStorage` pode estar fechado (modo privado): sem ele fica o Papel. */
function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function find(id: string | null | undefined): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0]
}

let current: Theme = find(storage()?.getItem(KEY) ?? DEFAULT)
const listeners = new Set<() => void>()

function loadFonts(look: Look) {
  const href = FONTS[look]
  if (!href) return
  const id = `gfit-fonts-${look}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

/** Põe o tema na raiz do documento. Chama-se uma vez antes de desenhar. */
export function applyTheme(theme: Theme = current) {
  const root = document.documentElement
  root.dataset.theme = theme.id
  root.dataset.look = theme.look
  loadFonts(theme.look)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme.chrome)
}

export function setTheme(id: ThemeId) {
  current = find(id)
  try {
    storage()?.setItem(KEY, current.id)
  } catch {
    // Sem espaço ou sem permissão: o tema muda na mesma, só não fica guardado.
  }
  applyTheme(current)
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** O tema em uso, e os ecrãs voltam a desenhar quando ele muda. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => current)
}
