import type { Invite } from './database.types'

/** A morada pública da app, para o convite levar a pessoa ao sítio certo. */
export function appUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}`
}

export function inviteSubject(invite: Invite, coachName: string | null): string {
  return invite.role === 'coach'
    ? 'Acesso de treinador à GFit'
    : `Convite do ${coachName ?? 'teu treinador'} para a GFit`
}

export function inviteBody(invite: Invite, coachName: string | null): string {
  const quem = coachName ?? 'O teu treinador'
  const papel =
    invite.role === 'coach'
      ? 'Ficas com acesso de treinador: os teus alunos, os planos e as dietas.'
      : 'Lá tens o teu plano de treino, a dieta e onde registas o peso, o sono e cada série que fazes.'

  return [
    `Olá${invite.full_name ? ` ${invite.full_name}` : ''},`,
    '',
    `${quem} convidou-te para a GFit. ${papel}`,
    '',
    'Para entrares:',
    `1. Abre ${appUrl()}`,
    `2. Entra com o email ${invite.email} — com o Google ou criando uma palavra-passe`,
    '',
    'Tem de ser esse email, senão o convite não te encontra.',
    '',
    'Dica: no telemóvel, usa Partilhar → Adicionar ao ecrã principal para ficares com a app instalada.',
  ].join('\n')
}

/**
 * Entrega o convite com o que o telemóvel tiver: a folha de partilha nativa
 * quando existe (WhatsApp, Gmail, o que a pessoa usar), senão um mailto que
 * abre a app de email já preenchida.
 *
 * Não há envio automático: a app é estática, não tem servidor que mande emails.
 */
export async function shareInvite(
  invite: Invite,
  coachName: string | null,
): Promise<'shared' | 'mail' | 'cancelled'> {
  const subject = inviteSubject(invite, coachName)
  const body = inviteBody(invite, coachName)

  if (navigator.share) {
    try {
      await navigator.share({ title: subject, text: body })
      return 'shared'
    } catch (error) {
      // O utilizador fechou a folha de partilha: não é um erro a comunicar.
      if (error instanceof Error && error.name === 'AbortError') return 'cancelled'
      // Qualquer outra falha cai no email.
    }
  }

  window.location.href =
    `mailto:${encodeURIComponent(invite.email)}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  return 'mail'
}

export async function copyInvite(
  invite: Invite,
  coachName: string | null,
): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(inviteBody(invite, coachName))
    return true
  } catch {
    return false
  }
}
