import { useSyncExternalStore } from 'react'

/**
 * O tema da app: cores, letra e forma, escolhidos no Perfil.
 *
 * A escolha fica no dispositivo e não no perfil, como a apresentação
 * (`tour.ts`): o tema tem de estar posto antes do primeiro desenho, e o
 * `index.html` lê-o do `localStorage` antes de haver sessão ou rede. Quem tem
 * a app em dois telemóveis escolhe nos dois.
 *
 * Quem ainda não escolheu nada abre no tema da casa (`profiles.theme`): o do
 * seu treinador, que no caso do Filipe Guerreiro é o Guerreiro. Chega com o
 * perfil, e fica também guardado no telemóvel para o arranque seguinte já
 * abrir nele. Escolher no Perfil ganha sempre ao da casa.
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

/** As mesmas chaves que o `index.html` lê antes de a app arrancar: a escolha
 *  de quem está a usar, e o tema da casa que veio com o perfil. */
const KEY = 'gfit.tema'
const HOUSE_KEY = 'gfit.tema.casa'

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

function read(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null
  } catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) storage()?.removeItem(key)
    else storage()?.setItem(key, value)
  } catch {
    // Sem espaço ou sem permissão: o tema muda na mesma, só não fica guardado.
  }
}

interface ThemeState {
  /** O tema em uso. */
  theme: Theme
  /** O da casa, quando há: é o que se vê sem escolher nada. */
  house: Theme | null
}

const chosen = read(KEY)
const house = read(HOUSE_KEY)
let state: ThemeState = {
  theme: find(chosen ?? house ?? DEFAULT),
  house: house ? find(house) : null,
}
const listeners = new Set<() => void>()

function update(next: ThemeState) {
  state = next
  applyTheme(state.theme)
  listeners.forEach((listener) => listener())
}

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
export function applyTheme(theme: Theme = state.theme) {
  const root = document.documentElement
  root.dataset.theme = theme.id
  root.dataset.look = theme.look
  loadFonts(theme.look)
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme.chrome)
}

/**
 * A escolha no Perfil. Escolher o tema que já se veria sem escolher nada — o da
 * casa, ou o Papel — é voltar a seguir a casa: se o treinador mudar de tema, a
 * pessoa acompanha.
 */
export function setTheme(id: ThemeId) {
  const fallback = state.house?.id ?? DEFAULT
  write(KEY, id === fallback ? null : id)
  update({ ...state, theme: find(id) })
}

/**
 * O tema da casa, que chega com o perfil a cada login. Só muda o ecrã a quem
 * ainda não escolheu nada no telemóvel.
 */
export function setHouseTheme(id: ThemeId | null) {
  if ((state.house?.id ?? null) === id) return
  write(HOUSE_KEY, id)
  const nextHouse = id ? find(id) : null
  const mine = read(KEY)
  update({ theme: find(mine ?? id ?? DEFAULT), house: nextHouse })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** O tema em uso, e os ecrãs voltam a desenhar quando ele muda. */
export function useTheme(): Theme {
  return useThemeState().theme
}

/** O tema em uso e o da casa, para o cartão de escolha. */
export function useThemeState(): ThemeState {
  return useSyncExternalStore(subscribe, () => state)
}
