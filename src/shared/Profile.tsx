import { useState } from 'react'
import { useAuth, useProfile } from '@/auth/useAuth'
import { Avatar } from '@/components/Avatar'
import { Loading, ScreenHeader, Stat } from '@/components/Screen'
import {
  createInvite,
  fetchAthleteProfile,
  fetchCoach,
  fetchInvites,
  revokeInvite,
} from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { describeError } from '@/lib/supabase'
import { int, plural, relativeDate, shortDate } from '@/lib/format'
import { unwrap, useQuery } from '@/lib/useQuery'
import './profile.css'

/**
 * Conta e definições, para os dois perfis. Chega-se aqui pelo avatar — que
 * antes disto era um botão de sair sem aviso nenhum.
 */
export function Profile() {
  const profile = useProfile()
  const { isCoach, signOut } = useAuth()

  const { data, loading, reload } = useQuery(async () => {
    if (isCoach) {
      return { invites: await fetchInvites(profile.id), coach: null, targets: null }
    }
    const [coach, targets] = await Promise.all([
      profile.coach_id ? fetchCoach(profile.coach_id) : Promise.resolve(null),
      fetchAthleteProfile(profile.id),
    ])
    return { invites: [], coach, targets }
  }, [profile.id, isCoach])

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

      {loading ? (
        <Loading label="A carregar" />
      ) : isCoach ? (
        <CoachSection
          coachId={profile.id}
          invites={data?.invites ?? []}
          onChanged={reload}
        />
      ) : (
        <AthleteSection coach={data?.coach ?? null} targets={data?.targets ?? null} />
      )}

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
  invites,
  onChanged,
}: {
  coachId: string
  invites: Awaited<ReturnType<typeof fetchInvites>>
  onChanged: () => void
}) {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  const pending = invites.filter((invite) => invite.status === 'pending')
  const accepted = invites.filter((invite) => invite.status === 'accepted')

  return (
    <>
      <section className="card">
        <span className="eyebrow">Convidar aluno</span>
        <p className="subtitle">
          O aluno entra com este email — Google ou palavra-passe — e fica logo
          ligado a ti.
        </p>

        <label className="field">
          <span className="field__label">Email</span>
          <input
            className="input"
            type="email"
            inputMode="email"
            value={email}
            placeholder="aluno@exemplo.pt"
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
              await createInvite(coachId, email, name.trim() || null)
              setEmail('')
              setName('')
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
          {busy ? 'A convidar…' : 'Criar convite'}
        </button>
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
                <span className="profile__invite-text">
                  <strong>{invite.email}</strong>
                  <em>
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
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card card--flat">
        <span className="eyebrow">Outro treinador</span>
        <p className="subtitle">
          Só se acrescenta na base de dados, de propósito: é a chave que dá
          acesso a todos os alunos. Em <em>gfit.app_config</em>, chave{' '}
          <em>coach_emails</em>.
        </p>
      </section>
    </>
  )
}

function AthleteSection({
  coach,
  targets,
}: {
  coach: { full_name: string | null; email: string | null } | null
  targets: Awaited<ReturnType<typeof fetchAthleteProfile>>
}) {
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
          <p className="subtitle">Ainda não estás ligado a nenhum treinador.</p>
        )}
      </section>

      {targets && (
        <section className="card">
          <span className="eyebrow">As tuas metas</span>
          <p className="subtitle">Definidas pelo treinador.</p>
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
          {targets.goal && (
            <div className="profile__goal">
              <span className="field__label">Objetivo</span>
              <p>{targets.goal}</p>
            </div>
          )}
        </section>
      )}
    </>
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
