import { Outlet } from 'react-router-dom'
import { TabBar, type Tab } from '@/components/TabBar'

const TABS: Tab[] = [
  { to: '/hoje', label: 'Hoje', icon: 'today' },
  { to: '/treino', label: 'Treino', icon: 'workout' },
  { to: '/dieta', label: 'Dieta', icon: 'plate' },
  { to: '/medidas', label: 'Medidas', icon: 'ruler' },
  { to: '/semana', label: 'Semana', icon: 'week' },
]

export function AthleteShell() {
  return (
    <div className="app">
      <Outlet />
      <TabBar tabs={TABS} />
    </div>
  )
}
