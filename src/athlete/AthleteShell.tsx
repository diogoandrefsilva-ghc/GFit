import { Outlet } from 'react-router-dom'
import { AppBar } from '@/components/AppBar'
import { TabBar, type Tab } from '@/components/TabBar'

const TABS: Tab[] = [
  { to: '/hoje', label: 'Hoje', icon: 'today' },
  { to: '/treino', label: 'Treino', icon: 'workout' },
  { to: '/dieta', label: 'Dieta', icon: 'plate' },
  { to: '/medidas', label: 'Medidas', icon: 'ruler' },
  { to: '/semana', label: 'Semana', icon: 'week' },
  { to: '/perfil', label: 'Perfil', icon: 'person' },
]

export function AthleteShell() {
  return (
    <div className="app">
      <AppBar />
      <Outlet />
      <TabBar tabs={TABS} />
    </div>
  )
}
