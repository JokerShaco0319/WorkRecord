import { useEffect, useState, type ReactNode } from 'react'
import type { SearchHit, VaultInfo } from '@shared/api'
import {
  CalendarIcon,
  ChartIcon,
  CheckSquareIcon,
  FolderIcon,
  MoonIcon,
  SearchIcon,
  SunIcon,
  TimerIcon
} from './icons'
import DayView from './DayView'
import ProjectsView from './ProjectsView'
import SearchOverlay from './SearchOverlay'
import StatsView from './StatsView'
import TodoView from './TodoView'
import WeeklyView from './WeeklyView'

type View = 'day' | 'todo' | 'projects' | 'weekly' | 'stats'

interface NavItemProps {
  icon: ReactNode
  label: string
  active?: boolean
  disabled?: boolean
  dataAction?: string
  onClick?: () => void
}

function NavItem({
  icon,
  label,
  active = false,
  disabled = false,
  dataAction,
  onClick
}: NavItemProps) {
  const className = [
    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors',
    active ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0_/_0.05)]' : 'text-muted',
    disabled ? 'cursor-default opacity-40' : 'hover:bg-surface/60'
  ].join(' ')

  const content = (
    <>
      <span className={active ? 'text-accent' : ''}>{icon}</span>
      <span>{label}</span>
    </>
  )

  if (!onClick) {
    return (
      <div aria-disabled={disabled || undefined} className={className}>
        {content}
      </div>
    )
  }

  return (
    <button type="button" data-action={dataAction} onClick={onClick} className={className}>
      {content}
    </button>
  )
}

interface WorkspaceProps {
  vault: VaultInfo
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

export default function Workspace({ vault, theme, onToggleTheme }: WorkspaceProps) {
  const [view, setView] = useState<View>('day')
  const [searchOpen, setSearchOpen] = useState(false)
  const [daySeed, setDaySeed] = useState<{ date: string; nonce: number } | null>(null)
  const [weekSeed, setWeekSeed] = useState<{ week: string; nonce: number } | null>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function openHit(hit: SearchHit): void {
    setSearchOpen(false)

    if (hit.kind === 'entry') {
      setDaySeed({ date: hit.date, nonce: Date.now() })
      setView('day')
    } else if (hit.kind === 'todo') {
      setView('todo')
    } else if (hit.kind === 'weekly') {
      setWeekSeed({ week: hit.week, nonce: Date.now() })
      setView('weekly')
    } else {
      void window.api.files.open(hit.project, hit.category, hit.name)
    }
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-[212px] shrink-0 flex-col border-r border-line">
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-center gap-2">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-accent text-[11px] font-semibold text-white">
              W
            </span>
            <span className="text-[13px] font-semibold tracking-tight">WorkRecord</span>
          </div>
        </div>

        <div className="px-3 pb-2">
          <button
            type="button"
            data-action="open-search"
            onClick={() => setSearchOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted transition-colors hover:bg-surface/60 hover:text-ink"
          >
            <SearchIcon className="h-4 w-4" />
            <span className="flex-1 text-left">搜索</span>
            <span className="rounded border border-line px-1 py-px text-[10px] text-muted/60">
              Ctrl K
            </span>
          </button>
        </div>

        <nav className="space-y-0.5 px-3">
          <NavItem
            icon={<CalendarIcon className="h-4 w-4" />}
            label="今日"
            active={view === 'day'}
            dataAction="nav-day"
            onClick={() => {
              setDaySeed(null)
              setView('day')
            }}
          />
          <NavItem
            icon={<CheckSquareIcon className="h-4 w-4" />}
            label="待办"
            active={view === 'todo'}
            dataAction="nav-todo"
            onClick={() => setView('todo')}
          />
          <NavItem
            icon={<FolderIcon className="h-4 w-4" />}
            label="项目"
            active={view === 'projects'}
            dataAction="nav-projects"
            onClick={() => setView('projects')}
          />
          <NavItem
            icon={<ChartIcon className="h-4 w-4" />}
            label="周报"
            active={view === 'weekly'}
            dataAction="nav-weekly"
            onClick={() => {
              setWeekSeed(null)
              setView('weekly')
            }}
          />
          <NavItem
            icon={<TimerIcon className="h-4 w-4" />}
            label="统计"
            active={view === 'stats'}
            dataAction="nav-stats"
            onClick={() => setView('stats')}
          />
        </nav>

        <div className="mt-auto border-t border-line/70 px-5 py-4">
          <button
            type="button"
            data-action="toggle-theme"
            onClick={onToggleTheme}
            className="mb-3 flex items-center gap-2 text-[11px] text-muted transition-colors hover:text-ink"
          >
            {theme === 'dark' ? (
              <SunIcon className="h-3.5 w-3.5" />
            ) : (
              <MoonIcon className="h-3.5 w-3.5" />
            )}
            {theme === 'dark' ? '切换到浅色' : '切换到深色'}
          </button>

          <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted/70">
            数据目录
          </div>
          <div className="mt-1 truncate text-[11px] text-muted" title={vault.path ?? ''}>
            {vault.path}
          </div>
        </div>
      </aside>

      <main className="min-w-0 flex-1 overflow-hidden">
        {view === 'day' && <DayView key={daySeed?.nonce ?? 'day'} initialDate={daySeed?.date} />}
        {view === 'todo' && <TodoView />}
        {view === 'projects' && <ProjectsView />}
        {view === 'weekly' && (
          <WeeklyView key={weekSeed?.nonce ?? 'week'} initialWeek={weekSeed?.week} />
        )}
        {view === 'stats' && <StatsView />}
      </main>

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} onOpen={openHit} />}
    </div>
  )
}
