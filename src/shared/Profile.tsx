import { useState } from 'react'
import { useAuth, useProfile } from '@/auth/useAuth'
import { Avatar } from '@/components/Avatar'
import { Loading, ScreenHeader, Stat } from '@/components/Screen'
import {
  createInvite,
  fetchCurrentTargets,
  fetchCoach,
  fetchInvites,
  revokeInvite,
} from '@/lib/api'
import { describeError, supabase } from '@/lib/supabase'
import { copyInvite, shareInvite } from '@/lib/invite'
import type { Invite, Role } from '@/lib/database.types'
import { int, plural, relativeDate, shortDate } from '@/lib/format'
import { THEMES, setTheme, useThemeState } from '@/lib/theme'
import { unwrap, useQuery } from '@/lib/useQuery'
import { Welcome } from './Welcome'
import './profile.css'

/**
 * Conta e definições, para os dois perfis. Chega-se aqui pelo avatar — que
 * antes disto era um botão de sair sem aviso nenhum.
 */
export function Profile() {
  const profile = useProfile()
  const { isCoach, signOut } = useAuth()

  const { data, loading, reload } = useQuery(['perfil', profile.id, isCoach], async () => {
    if (isCoach) {
      return { invites: await fetchInvites(profile.id), coach: null, targets: null }
    }
    const [coach, targets] = await Promise.all([
      profile.coach_id ? fetchCoach(profile.coach_id) : Promise.resolve(null),
      fetchCurrentTargets(profile.id),
    ])
    return { invites: [], coach, targets }
  })

  return (
    <div className="screen">
      <ScreenHeader back title="Perfil" />

      <section className="card profile__me">
        <Avatar name={profile.full_name} url={profile.avatar_url} size={64} />
        <div className="profile__id">
          <NameField />
          <span className="profile__email">{profile.email}</span>
          <span className={`chip ${isCoach ? 'chip--accent' : ''}`}>
            {isCoach ? 'Treinador' : 'Aluno'}
          </span>
        </div>
      </section>

      <ThemeCard />

      {loading ? (
        <Loading label="A carregar" />
      ) : isCoach ? (
        <CoachSection
          coachId={profile.id}
          coachName={profile.full_name}
          invites={data?.invites ?? []}
          onChanged={reload}
        />
      ) : (
        <AthleteSection coach={data?.coach ?? null} targets={data?.targets ?? null} />
      )}

      {isCoach && (
        <section className="card card--flat">
          <span className="eyebrow">O meu treino</span>
          <p className="subtitle">
            Também treinas: o separador <strong>Eu</strong> é o teu lado de
            aluno — o registo do dia, os teus treinos, as medidas e as metas que
            pões a ti próprio.
          </p>
        </section>
      )}

      <TourCard />

      <InstallHint />

      <section className="card">
        <span className="eyebrow">Sessão</span>
        <SignOutButton onConfirm={signOut} />
      </section>

      <p className="profile__foot">
        GFit · dados no Supabase, app publicada no GitHub Pages
      </p>
    </div>
  )
}

/** O nome é o único campo que cada um edita de si próprio. */
function NameField() {
  const profile = useProfile()
  const { refreshProfile } = useAuth()
  const [value, setValue] = useState(profile.full_name ?? '')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  if (!editing) {
    return (
      <button
        type="button"
        className="profile__name"
        onClick={() => setEditing(true)}
      >
        {profile.full_name || 'Sem nome'}
        <em>editar</em>
      </button>
    )
  }

  return (
    <div className="profile__name-edit">
      <input
        className="input"
        value={value}
        autoFocus
        onChange={(event) => setValue(event.target.value)}
      />
      {failure && <p className="error-banner">{failure}</p>}
      <div className="row">
        <button
          type="button"
          className="btn btn--sm btn--quiet"
          onClick={() => {
            setValue(profile.full_name ?? '')
            setFailure(null)
            setEditing(false)
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn--sm btn--primary"
          disabled={busy || value.trim().length === 0}
          onClick={async () => {
            setBusy(true)
            setFailure(null)
            try {
              unwrap(
                await supabase
                  .from('profiles')
                  .update({ full_name: value.trim() })
                  .eq('id', profile.id)
                  .select(),
              )
              await refreshProfile()
              setEditing(false)
            } catch (caught) {
              setFailure(describeError(caught))
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'A guardar…' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}

function CoachSection({
  coachId,
  coachName,
  invites,
  onChanged,
}: {
  coachId: string
  coachName: string | null
  invites: Invite[]
  onChanged: () => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('athlete')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [justCreated, setJustCreated] = useState<Invite | null>(null)

  const pending = invites.filter((invite) => invite.status === 'pending')
  const accepted = invites.filter((invite) => invite.status === 'accepted')

  return (
    <>
      <section className="card">
        <span className="eyebrow">Convidar</span>

        <div className="row profile__roles">
          {(
            [
              ['athlete', 'Aluno'],
              ['coach', 'Treinador'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`chip ${role === value ? 'chip--on' : ''}`}
              onClick={() => setRole(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <p className="subtitle">
          {role === 'athlete'
            ? 'O aluno entra com este email — Google ou palavra-passe — e fica logo ligado a ti.'
            : 'Um treinador tem os seus próprios alunos e vê a base de exercícios e alimentos. Não vê os teus alunos.'}
        </p>

        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="input"
            type="email"
            inputMode="email"
            value={email}
            placeholder={role === 'athlete' ? 'aluno@exemplo.pt' : 'treinador@exemplo.pt'}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">Nome (opcional)</span>
          <input
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        {failure && <p className="error-banner">{failure}</p>}

        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={busy || !email.includes('@')}
          onClick={async () => {
            setBusy(true)
            setFailure(null)
            try {
              const invite = await createInvite(
                coachId,
                email,
                name.trim() || null,
                role,
              )
              setEmail('')
              setName('')
              setJustCreated(invite)
              onChanged()
            } catch (caught) {
              const message = describeError(caught)
              setFailure(
                /duplicate key|invites_pending_email_uq/i.test(message)
                  ? 'Já existe um convite pendente para este email.'
                  : message,
              )
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'A criar…' : 'Criar convite'}
        </button>

        {justCreated && (
          <div className="profile__created">
            <p>
              Convite criado para <strong>{justCreated.email}</strong>. Falta
              avisá-lo — a app não envia emails sozinha.
            </p>
            <SendButtons invite={justCreated} coachName={coachName} />
          </div>
        )}
      </section>

      <section className="card">
        <div className="card__head">
          <span className="eyebrow">Convites</span>
          <span className="muted profile__count">
            {pending.length} por aceitar ·{' '}
            {plural(accepted.length, 'aceite', 'aceites')}
          </span>
        </div>

        {invites.length === 0 ? (
          <p className="subtitle">Ainda não convidaste ninguém.</p>
        ) : (
          <ul className="profile__invites">
            {invites.map((invite) => (
              <li key={invite.id} className="profile__invite">
                <div className="profile__invite-head">
                  <span className="profile__invite-text">
                    <strong>{invite.email}</strong>
                    <em>
                      {invite.role === 'coach' ? 'treinador · ' : ''}
                      {invite.status === 'pending' && 'por aceitar'}
                      {invite.status === 'accepted' &&
                        `aceite ${relativeDate((invite.accepted_at ?? invite.created_at).slice(0, 10))}`}
                      {invite.status === 'revoked' && 'anulado'}
                      {' · '}
                      {shortDate(invite.created_at.slice(0, 10))}
                    </em>
                  </span>
                  {invite.status === 'pending' && (
                    <button
                      type="button"
                      className="btn btn--sm btn--quiet"
                      onClick={async () => {
                        await revokeInvite(invite.id)
                        onChanged()
                      }}
                    >
                      Anular
                    </button>
                  )}
                </div>
                {invite.status === 'pending' && (
                  <SendButtons invite={invite} coachName={coachName} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

/** Entrega do convite: a app é estática, quem manda a mensagem és tu. */
function SendButtons({
  invite,
  coachName,
}: {
  invite: Invite
  coachName: string | null
}) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="row profile__send">
      <button
        type="button"
        className="btn btn--sm btn--accent"
        onClick={() => shareInvite(invite, coachName)}
      >
        Enviar convite
      </button>
      <button
        type="button"
        className="btn btn--sm btn--quiet"
        onClick={async () => {
          setCopied(await copyInvite(invite, coachName))
          window.setTimeout(() => setCopied(false), 2000)
        }}
      >
        {copied ? 'Copiado ✓' : 'Copiar texto'}
      </button>
    </div>
  )
}

function AthleteSection({
  coach,
  targets,
}: {
  coach: { full_name: string | null; email: string | null } | null
  targets: Awaited<ReturnType<typeof fetchCurrentTargets>>
}) {
  const { refreshProfile } = useAuth()
  const [checking, setChecking] = useState(false)

  return (
    <>
      <section className="card">
        <span className="eyebrow">O teu treinador</span>
        {coach ? (
          <div className="profile__coach">
            <Avatar name={coach.full_name} size={40} />
            <div>
              <strong>{coach.full_name ?? 'Treinador'}</strong>
              <span className="muted">{coach.email}</span>
            </div>
          </div>
        ) : (
          <>
            <p className="subtitle">
              Treinas por tua conta: os planos são os que escreves, e as metas
              as que pões a ti próprio, no ecrã Medidas. Se um treinador te
              convidar com este email, ficas ligado a ele sem perder nada do que
              já registaste.
            </p>
            <button
              type="button"
              className="btn btn--ghost btn--block"
              disabled={checking}
              onClick={async () => {
                setChecking(true)
                try {
                  await refreshProfile()
                } finally {
                  setChecking(false)
                }
              }}
            >
              {checking ? 'A verificar…' : 'Já fui convidado'}
            </button>
          </>
        )}
      </section>

      {targets && (
        <section className="card">
          <span className="eyebrow">As tuas metas</span>
          <p className="subtitle">
            {coach ? 'Definidas pelo treinador.' : 'Definidas por ti, no ecrã Medidas.'}
          </p>
          <div className="row">
            <Stat label="Kcal" value={targets.kcal_target ? int(targets.kcal_target) : '—'} />
            <Stat
              label="Proteína"
              value={targets.protein_target_g ? `${targets.protein_target_g} g` : '—'}
            />
          </div>
          <div className="row">
            <Stat
              label="Gordura"
              value={targets.fat_target_g ? `${targets.fat_target_g} g` : '—'}
            />
            <Stat
              label="Hidratos"
              value={targets.carb_target_g ? `${targets.carb_target_g} g` : '—'}
            />
          </div>
          <div className="row">
            <Stat label="Passos" value={targets.steps_goal ? int(targets.steps_goal) : '—'} />
            <Stat
              label="Sono"
              value={targets.sleep_goal_hours ? `${targets.sleep_goal_hours} h` : '—'}
            />
          </div>
          {targets.objective && (
            <div className="profile__goal">
              <span className="field__label">Objetivo</span>
              <p>{targets.objective}</p>
            </div>
          )}
        </section>
      )}
    </>
  )
}

/**
 * O tema da app. Muda no toque, sem gravar nada no servidor: fica neste
 * telemóvel, como a apresentação. O da casa — o do treinador — leva uma marca,
 * que é o que se vê sem escolher nada.
 */
function ThemeCard() {
  const { isCoach } = useAuth()
  const { theme, house } = useThemeState()
  const houseLabel = isCoach ? 'da casa' : 'do treinador'

  return (
    <section className="card">
      <span className="eyebrow">Tema</span>
      <div className="themes" role="radiogroup" aria-label="Tema da app">
        {THEMES.map((option) => {
          const [ground, surface, brand] = option.swatches
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={option.id === theme.id}
              className={`theme-pick ${option.id === theme.id ? 'is-on' : ''}`}
              onClick={() => setTheme(option.id)}
            >
              <span
                className="theme-pick__preview"
                style={{ background: ground }}
                aria-hidden="true"
              >
                {option.id === 'guerreiro' ? (
                  <img
                    className="theme-pick__logo"
                    src={`${import.meta.env.BASE_URL}guerreiro-wordmark.png`}
                    alt=""
                  />
                ) : (
                  <span className="theme-pick__card" style={{ background: surface }} />
                )}
                <span className="theme-pick__bar" style={{ background: brand }} />
              </span>
              <span className="theme-pick__text">
                <span className="theme-pick__name">
                  <strong>{option.name}</strong>
                  {house?.id === option.id && (
                    <span className="theme-pick__house">{houseLabel}</span>
                  )}
                </span>
                <em>{option.hint}</em>
              </span>
            </button>
          )
        })}
      </div>
      <p className="profile__theme-note">
        {house
          ? `Sem escolher nada, a app abre no ${house.name}, o tema ${houseLabel}. A escolha fica guardada neste telemóvel.`
          : 'Fica guardado neste telemóvel.'}
      </p>
    </section>
  )
}

/**
 * A apresentação da app, a pedido. Fica ao lado das outras coisas que se
 * explicam uma vez: quem a saltou no primeiro dia encontra-a aqui, e quem só
 * quer confirmar onde é que aquilo estava não tem de andar à procura.
 */
function TourCard() {
  const [open, setOpen] = useState(false)

  return (
    <section className="card card--flat">
      <span className="eyebrow">Como funciona a app</span>
      <p className="subtitle">
        O que aparece na primeira vez: o que faz cada separador, em meia dúzia
        de cartões.
      </p>
      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={() => setOpen(true)}
      >
        Rever a apresentação
      </button>
      {open && <Welcome mode="review" onClose={() => setOpen(false)} />}
    </section>
  )
}

/** No iOS a app só se instala pelo Partilhar → Adicionar ao ecrã principal. */
function InstallHint() {
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // Safari no iOS não implementa display-mode, expõe isto em vez disso.
    (window.navigator as { standalone?: boolean }).standalone === true

  if (standalone) return null

  return (
    <section className="card card--flat">
      <span className="eyebrow">Instalar no telemóvel</span>
      <p className="subtitle">
        No iPhone: Partilhar → Adicionar ao ecrã principal. No Android: menu do
        browser → Instalar aplicação. Fica com ícone próprio e abre sem a barra
        do browser.
      </p>
    </section>
  )
}

function SignOutButton({ onConfirm }: { onConfirm: () => void }) {
  const [asking, setAsking] = useState(false)

  if (!asking) {
    return (
      <button
        type="button"
        className="btn btn--ghost btn--block"
        onClick={() => setAsking(true)}
      >
        Terminar sessão
      </button>
    )
  }

  return (
    <div className="profile__confirm">
      <p className="subtitle">Sair da conta neste dispositivo?</p>
      <div className="row">
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => setAsking(false)}
        >
          Ficar
        </button>
        <button type="button" className="btn btn--accent" onClick={onConfirm}>
          Sair
        </button>
      </div>
    </div>
  )
}
