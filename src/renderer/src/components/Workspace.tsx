import { lazy, Suspense, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import type { SearchHit, VaultInfo } from '@shared/api'
import { DEFAULT_UI_LAYOUT, UI_LAYOUT_LIMITS } from '@shared/layout'
import {
  CalendarIcon,
  ChartIcon,
  CheckSquareIcon,
  FolderIcon,
  GearIcon,
  ReportIcon,
  SearchIcon,
  TimerIcon
} from './icons'
import DayView from './DayView'
import { useUiLayout } from './LayoutProvider'
import ProjectsView from './ProjectsView'
import ResizeHandle from './ResizeHandle'
import SearchOverlay from './SearchOverlay'
import SettingsView from './SettingsView'
import StatsView from './StatsView'
import TodoView from './TodoView'

const WeeklyView = lazy(() => import('./WeeklyView'))
const MonthlyView = lazy(() => import('./MonthlyView'))

type View = 'day' | 'todo' | 'projects' | 'weekly' | 'month' | 'stats' | 'settings'

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
    'flex w-full items-center justify-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors lg:justify-start',
    active ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0_/_0.05)]' : 'text-muted',
    disabled ? 'cursor-default opacity-40' : 'hover:bg-surface/60'
  ].join(' ')

  const content = (
    <>
      <span className={active ? 'text-accent' : ''}>{icon}</span>
      <span className="hidden lg:inline">{label}</span>
    </>
  )

  if (!onClick) {
    return (
      <div aria-disabled={disabled || undefined} className={className} title={label}>
        {content}
      </div>
    )
  }

  return (
    <button
      type="button"
      data-action={dataAction}
      title={label}
      onClick={onClick}
      className={className}
    >
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
  const { layout, preview, commit } = useUiLayout()
  const [view, setView] = useState<View>('day')
  const [searchOpen, setSearchOpen] = useState(false)
  const [daySeed, setDaySeed] = useState<{ date: string; nonce: number } | null>(null)
  const [weekSeed, setWeekSeed] = useState<{ week: string; nonce: number } | null>(null)

  const rootStyle = {
    '--sidebar-width': `${layout.sidebarWidth}px`
  } as CSSProperties

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
      void window.api.files.open(hit.project, hit.category, hit.path)
    }
  }

  return (
    <div className="flex h-full" style={rootStyle}>
      <aside className="flex w-16 shrink-0 flex-col border-r border-line lg:w-[var(--sidebar-width)] lg:border-r-0">
        <div className="px-2 pb-4 pt-6 lg:px-5">
          <div className="flex items-center justify-center gap-2 lg:justify-start">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-ink text-[11px] font-semibold text-paper">
              W
            </span>
            <span className="hidden text-[13px] font-semibold tracking-tight lg:inline">
              WorkRecord
            </span>
          </div>
        </div>

        <div className="px-2 pb-2 lg:px-3">
          <button
            type="button"
            data-action="open-search"
            onClick={() => setSearchOpen(true)}
            title="搜索 (Ctrl K)"
            aria-label="搜索"
            className="flex w-full items-center justify-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-muted transition-colors hover:bg-surface/60 hover:text-ink lg:justify-start"
          >
            <SearchIcon className="h-4 w-4" />
            <span className="hidden flex-1 text-left lg:inline">搜索</span>
            <span className="hidden rounded border border-line px-1 py-px text-[10px] text-muted/60 lg:inline">
              Ctrl K
            </span>
          </button>
        </div>

        <nav className="space-y-0.5 px-2 lg:px-3">
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
            icon={<ReportIcon className="h-4 w-4" />}
            label="月报"
            active={view === 'month'}
            dataAction="nav-month"
            onClick={() => setView('month')}
          />
          <NavItem
            icon={<TimerIcon className="h-4 w-4" />}
            label="统计"
            active={view === 'stats'}
            dataAction="nav-stats"
            onClick={() => setView('stats')}
          />
        </nav>

        <div className="mt-auto border-t border-line/70 px-2 pb-4 pt-3 lg:px-3">
          <button
            type="button"
            data-action="nav-settings"
            title="设置"
            aria-label="设置"
            onClick={() => setView('settings')}
            className={`flex w-full items-center justify-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] transition-colors lg:justify-start ${
              view === 'settings'
                ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0_/_0.05)]'
                : 'text-muted hover:bg-surface/60'
            }`}
          >
            <GearIcon className={`h-4 w-4 ${view === 'settings' ? 'text-accent' : ''}`} />
            <span className="hidden lg:inline">设置</span>
          </button>

          <div className="mt-3 hidden px-3 lg:block">
            <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted/70">
              数据目录
            </div>
            <div className="mt-1 truncate text-[11px] text-muted" title={vault.path ?? ''}>
              {vault.path}
            </div>
          </div>
        </div>
      </aside>

      <ResizeHandle
        className="max-lg:hidden"
        value={layout.sidebarWidth}
        min={UI_LAYOUT_LIMITS.sidebarWidth.min}
        max={UI_LAYOUT_LIMITS.sidebarWidth.max}
        defaultValue={DEFAULT_UI_LAYOUT.sidebarWidth}
        ariaLabel="调整导航栏宽度"
        onPreview={(sidebarWidth) => preview({ sidebarWidth })}
        onCommit={(sidebarWidth) => commit({ sidebarWidth })}
      />

      <main className="min-w-0 flex-1 overflow-hidden">
        {view === 'day' && <DayView key={daySeed?.nonce ?? 'day'} initialDate={daySeed?.date} />}
        {view === 'todo' && <TodoView />}
        {view === 'projects' && <ProjectsView />}
        {view === 'weekly' && (
          <Suspense fallback={<div className="p-10 text-[12px] text-muted">正在加载周报…</div>}>
            <WeeklyView key={weekSeed?.nonce ?? 'week'} initialWeek={weekSeed?.week} />
          </Suspense>
        )}
        {view === 'month' && (
          <Suspense fallback={<div className="p-10 text-[12px] text-muted">正在加载月报…</div>}>
            <MonthlyView />
          </Suspense>
        )}
        {view === 'stats' && <StatsView />}
        {view === 'settings' && (
          <SettingsView vaultPath={vault.path} theme={theme} onToggleTheme={onToggleTheme} />
        )}
      </main>

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} onOpen={openHit} />}
    </div>
  )
}
