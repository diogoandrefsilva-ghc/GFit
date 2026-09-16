import { initials } from '@/lib/format'
import './avatar.css'

interface Props {
  name: string | null | undefined
  url?: string | null
  size?: number
  tone?: 'ink' | 'accent' | 'paper'
}

export function Avatar({ name, url, size = 40, tone = 'ink' }: Props) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.36) }

  if (url) {
    return (
      <img className="avatar avatar--photo" style={style} src={url} alt="" />
    )
  }
  return (
    <span className={`avatar avatar--${tone}`} style={style} aria-hidden="true">
      {initials(name)}
    </span>
  )
}
