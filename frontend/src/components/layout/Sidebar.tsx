import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ListPlus, History, MapPinned, Database } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/new-task', label: 'New Task', icon: ListPlus },
  { to: '/directory', label: 'Direktori Data', icon: Database },
  { to: '/tasks', label: 'Task History', icon: History },
];

export function Sidebar() {
  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-[var(--color-ink)] text-[var(--color-text-inverse)]">
      <div className="map-grid-texture flex items-center gap-2.5 border-b border-white/10 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--color-accent)]">
          <MapPinned className="h-4.5 w-4.5 text-white" strokeWidth={2.25} />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">
            <span className="text-[color-mix(in_srgb,var(--color-accent)_65%,white)]">Peta</span>
            <span className="text-white">Data</span>
          </p>
          <p className="mt-1 text-[11px] text-white/50">Scraper Dashboard</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 px-3 py-4">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              )
            }
          >
            <Icon className="h-4 w-4" strokeWidth={2} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 px-5 py-4">
        <p className="text-[11px] leading-relaxed text-white/40">
          Orchestration untuk auto-scroll scraper engine — data tetap tersimpan lokal di mesin ini.
        </p>
      </div>
    </aside>
  );
}