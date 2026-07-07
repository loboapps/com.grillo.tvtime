import { NavLink } from 'react-router-dom'
import { icons } from '@/utils/icons'

const ITEMS = [
  { to: '/', label: 'Shows', Icon: icons.shows },
  { to: '/search', label: 'Search', Icon: icons.search },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-tvtime-800 border-t border-tvtime-700 flex justify-around py-2">
      {ITEMS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            `flex flex-col items-center gap-1 text-xs ${isActive ? 'text-tvtime-100' : 'text-tvtime-400'}`
          }
        >
          <Icon size={22} />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
