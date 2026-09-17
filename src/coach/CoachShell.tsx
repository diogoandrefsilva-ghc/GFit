import { Outlet } from 'react-router-dom'
import { AppBar } from '@/components/AppBar'
import { TabBar, type Tab } from '@/components/TabBar'

const TABS: Tab[] = [
  { to: '/inicio', label: 'Início', icon: 'today' },
  { to: '/alunos', label: 'Alunos', icon: 'people' },
  { to: '/calendario', label: 'Calendário', icon: 'calendar' },
  { to: '/exercicios', label: 'Exercícios', icon: 'library' },
  { to: '/perfil', label: 'Perfil', icon: 'person' },
]

export function CoachShell() {
  return (
    <div className="app">
      <AppBar />
      <Outlet />
      <TabBar tabs={TABS} />
    </div>
  )
}
