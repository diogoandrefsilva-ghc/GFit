import { NavLink } from 'react-router-dom'
import './tabbar.css'

export interface Tab {
  to: string
  label: string
  icon:
    | 'today'
    | 'workout'
    | 'ruler'
    | 'plate'
    | 'week'
    | 'people'
    | 'library'
    | 'person'
    | 'calendar'
  badge?: number
}

export function TabBar({ tabs }: { tabs: Tab[] }) {
  return (
    <nav className="tabbar" aria-label="Navegação principal">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          className={({ isActive }) => `tabbar__item ${isActive ? 'is-on' : ''}`}
        >
          <span className="tabbar__icon">
            <Icon name={tab.icon} />
            {tab.badge ? <em className="tabbar__badge">{tab.badge}</em> : null}
          </span>
          <span className="tabbar__label">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function Icon({ name }: { name: Tab['icon'] }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }

  switch (name) {
    case 'today':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
        </svg>
      )
    case 'workout':
      return (
        <svg {...common}>
          <path d="M4 9v6M20 9v6M7 7v10M17 7v10M7 12h10" />
        </svg>
      )
    case 'ruler':
      return (
        <svg {...common}>
          <rect x="2.5" y="8" width="19" height="8" rx="2" />
          <path d="M7 8v3M11 8v4M15 8v3M19 8v4" />
        </svg>
      )
    case 'plate':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      )
    case 'week':
      return (
        <svg {...common}>
          <path d="M4 18V9M10 18V5M16 18v-6M22 18H2" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M8 3v4M16 3v4M3 10h18" />
          <path d="M7.5 14h2M14.5 14h2M7.5 17.5h2M14.5 17.5h2" />
        </svg>
      )
    case 'people':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.4" />
          <path d="M3 19c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2M17 8.2a3 3 0 0 1 0 5.6M18 19c0-2.2-.9-3.7-2.2-4.6" />
        </svg>
      )
    case 'library':
      return (
        <svg {...common}>
          <path d="M4 5h6v14H4zM14 5h6v14h-6M14 10h6" />
        </svg>
      )
    case 'person':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.6" />
          <path d="M5 19.5c0-3.4 3.1-5.6 7-5.6s7 2.2 7 5.6" />
        </svg>
      )
  }
}
