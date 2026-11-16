import { useCallback, useEffect, useState } from 'react'
import type { ProjectSummary } from '@shared/api'
import ProjectDetail from './ProjectDetail'

const PALETTE = ['#2f6b5f', '#4f6a8a', '#8a6a4a', '#7a5c7e', '#4f7a52']

function projectColor(name: string): string {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return PALETTE[hash % PALETTE.length]
}

/** 中文项目名常以「项目」开头，取后面更有辨识度的字 */
function projectInitial(name: string): string {
  const meaningful = name.replace(/^项目/, '').trim()
  return (meaningful || name).slice(0, 1)
}

function formatUpdated(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getMonth() + 1} 月 ${date.getDate()} 日`
}

export default function ProjectsView() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setProjects(await window.api.projects.list())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const visibleProjects = (projects ?? []).filter((project) => {
    if (filter === 'all') return true
    if (filter === 'archived') return project.status === 'archived'
    return project.status !== 'archived'
  })

  async function create(): Promise<void> {
    const value = name.trim()
    if (!value) return
    try {
      const project = await window.api.projects.create(value)
      setName('')
      setCreating(false)
      setError(null)
      await refresh()
      setSelected(project.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  if (selected) {
    return (
      <ProjectDetail
        name={selected}
        onBack={() => {
          setSelected(null)
          void refresh()
        }}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-10 pb-6 pt-10">
        <div className="mx-auto w-full max-w-[980px]">
          <div className="flex items-end justify-between gap-6">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
                Projects
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <h1 className="text-[27px] font-semibold tracking-tight">项目</h1>
                <span className="text-sm text-muted">{visibleProjects.length} 个</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="flex rounded-lg border border-line bg-paper p-0.5">
                {(
                  [
                    ['active', '进行中'],
                    ['archived', '已归档'],
                    ['all', '全部']
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    data-action={`projects-filter-${key}`}
                    onClick={() => setFilter(key)}
                    className={`rounded-[6px] px-2.5 py-1 text-[11px] transition-colors ${
                      filter === key
                        ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0_/_0.06)]'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                data-action="project-new"
                onClick={() => setCreating((open) => !open)}
                className="h-7 rounded-md bg-accent px-3 text-[11px] font-medium text-white transition hover:brightness-110"
              >
                新建项目
              </button>
            </div>
          </div>

          {creating && (
            <div className="mt-4 flex items-center gap-2">
              <input
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    void create()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setCreating(false)
                    setName('')
                  }
                }}
                placeholder="项目名称"
                className="h-8 w-64 rounded-lg border border-accent/40 bg-surface px-2.5 text-[13px] outline-none"
              />
              <button
                type="button"
                onClick={() => void create()}
                className="h-8 rounded-lg bg-accent px-3 text-[12px] font-medium text-white transition hover:brightness-110"
              >
                创建
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false)
                  setName('')
                }}
                className="h-8 rounded-lg px-2 text-[12px] text-muted transition-colors hover:text-ink"
              >
                取消
              </button>
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-10 pb-14">
        <div className="mx-auto w-full max-w-[980px]">
          {projects === null ? null : visibleProjects.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {visibleProjects.map((project) => (
                <button
                  key={project.name}
                  type="button"
                  data-action={`project-open-${project.name}`}
                  onClick={() => setSelected(project.name)}
                  className="flex flex-col rounded-xl border border-line bg-surface p-4 text-left transition-colors hover:border-accent/40"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-semibold text-white"
                      style={{ backgroundColor: projectColor(project.name) }}
                    >
                      {projectInitial(project.name)}
                    </span>
                    <span className="truncate text-[14px] font-medium">{project.name}</span>
                    {project.status !== 'active' && (
                      <span
                        className={`ml-auto shrink-0 rounded px-1.5 py-px text-[10px] ${
                          project.status === 'archived'
                            ? 'bg-line/60 text-muted'
                            : 'bg-accent-soft text-accent'
                        }`}
                      >
                        {project.status === 'archived' ? '已归档' : '暂停'}
                      </span>
                    )}
                  </div>

                  <p className="mt-3 line-clamp-2 min-h-[32px] text-[12px] leading-4 text-muted">
                    {project.description || '暂无描述'}
                  </p>

                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted/70">
                    <span>{project.fileCount} 个文件</span>
                    {project.updatedAt && (
                      <>
                        <span>·</span>
                        <span>更新于 {formatUpdated(project.updatedAt)}</span>
                      </>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-16 text-center">
              <p className="text-sm text-muted">
                {projects?.length === 0 ? '还没有项目' : '这个筛选下没有项目'}
              </p>
              <p className="mt-1 text-xs text-muted/70">
                {projects?.length === 0
                  ? '点右上角「新建项目」，开始整理工作文件'
                  : '切换上方筛选看看其它状态的项目'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
