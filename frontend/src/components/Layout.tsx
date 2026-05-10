import { NavLink, Outlet } from 'react-router-dom'
import { LayoutDashboard, FolderOpen, Copy, Disc, Anchor, BookMarked, Settings } from 'lucide-react'
import clsx from 'clsx'

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/library', label: 'Library', icon: FolderOpen },
  { to: '/duplicates', label: 'Duplicates', icon: Copy },
  { to: '/iso-files', label: 'ISO Files', icon: Disc },
  { to: '/baselines', label: 'Baselines', icon: BookMarked },
  { to: '/integrations', label: 'Integrations', icon: Anchor },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-[#1a1d27] border-r border-[#2a2d3a] flex flex-col">
        <div className="px-5 py-5 border-b border-[#2a2d3a]">
          <span className="text-lg font-bold text-white tracking-tight">📼 Managarr</span>
        </div>
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-gray-400 hover:text-gray-100 hover:bg-white/5',
                )
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
