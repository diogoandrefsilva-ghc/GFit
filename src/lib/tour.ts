/**
 * Quem já viu a apresentação da app.
 *
 * Fica no dispositivo e não no perfil, de propósito: a apresentação tem de
 * aparecer no primeiro ecrã, antes de qualquer ida ao servidor, e o que ela
 * explica — onde tocar, o que faz cada separador — é de quem está a segurar o
 * telemóvel. Quem instalar a app noutro sítio vê-a outra vez, e está bem.
 *
 * Ao contrário do cache, isto sobrevive a terminar sessão: voltar a entrar na
 * própria conta não é ser novo. A chave leva o id do utilizador na mesma, para
 * que num telemóvel partilhado cada um tenha a sua primeira vez.
 */

const KEY = 'gfit.tour.'

/**
 * Sobe quando a apresentação mudar o suficiente para valer a pena mostrá-la
 * de novo a quem já a viu. Mexer aqui é uma decisão: toda a gente a leva
 * outra vez à frente.
 */
export const TOUR_VERSION = 1

/** O `localStorage` pode estar fechado (modo privado): sem ele a app anda na mesma. */
function storage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function hasSeenTour(userId: string): boolean {
  const raw = storage()?.getItem(KEY + userId)
  return raw !== null && raw !== undefined && Number(raw) >= TOUR_VERSION
}

export function markTourSeen(userId: string) {
  try {
    storage()?.setItem(KEY + userId, String(TOUR_VERSION))
  } catch {
    // Sem onde guardar, a apresentação volta no próximo arranque. É o menor
    // dos males: o contrário era engolir a escolha e não a cumprir.
  }
}

/** Desmarcar a caixa no fim da apresentação traz-la de volta da próxima vez. */
export function forgetTour(userId: string) {
  try {
    storage()?.removeItem(KEY + userId)
  } catch {
    // idem
  }
}
