import { useCallback, useEffect, useRef, useState } from 'react'
import type { ProjectDetail as ProjectDetailData, ProjectFileInfo } from '@shared/api'
import AssetsPanel from './AssetsPanel'
import { ChevronLeftIcon, FileIcon, FolderIcon, TrashIcon } from './icons'

interface Props {
  name: string
  onBack: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatModified(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${month}-${day}`
}

export default function ProjectDetail({ name, onBack }: Props) {
  const [detail, setDetail] = useState<ProjectDetailData | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [mode, setMode] = useState<'files' | 'assets'>('files')
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const confirmTimer = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      const next = await window.api.projects.read(name)
      setDetail(next)
      setCategory((prev) => (prev && next.categories.includes(prev) ? prev : next.categories[0] ?? null))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [name])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    return () => {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
    }
  }, [])

  async function run(action: Promise<ProjectDetailData | null>): Promise<void> {
    try {
      const next = await action
      if (next) setDetail(next)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function submitCategory(): Promise<void> {
    const value = newCategory.trim()
    if (!value || !category) return
    try {
      const next = await window.api.projects.addCategory(name, value)
      setDetail(next)
      setCategory(value)
      setNewCategory('')
      setAdding(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDrop(event: React.DragEvent): Promise<void> {
    event.preventDefault()
    setDragOver(false)
    if (mode !== 'files' || !category) return

    const paths: string[] = []
    for (const file of Array.from(event.dataTransfer.files)) {
      try {
        const path = window.api.files.pathOf(file)
        if (path) paths.push(path)
      } catch {
        // 非本地文件忽略
      }
    }
    if (paths.length === 0) return

    await run(window.api.files.importPaths(name, category, paths))
  }

  function armConfirm(fileName: string): void {
    setConfirming(fileName)
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
    confirmTimer.current = window.setTimeout(() => setConfirming(null), 3000)
  }

  const categories = detail?.categories ?? []
  const files = detail?.files.filter((file) => file.category === category) ?? []

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-line/60 px-10 pt-8 pb-3">
        <div className="mx-auto w-full max-w-[980px]">
          <button
            type="button"
            onClick={onBack}
            data-action="project-back"
            className="flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-ink"
          >
            <ChevronLeftIcon className="h-3 w-3" />
            全部项目
          </button>

          <div className="mt-2 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="truncate text-[22px] font-semibold tracking-tight">
                {detail?.name ?? name}
              </h1>
              <p className="mt-1 line-clamp-2 text-[12px] text-muted">
                {detail?.description || '暂无描述'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="flex rounded-lg border border-line bg-paper p-0.5">
                {(
                  [
                    ['files', '文件'],
                    ['assets', '加密资产']
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    data-action={`project-mode-${key}`}
                    onClick={() => setMode(key)}
                    className={`rounded-[6px] px-2.5 py-1 text-[11px] transition-colors ${
                      mode === key
                        ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0_/_0.06)]'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {mode === 'files' && (
                <button
                  type="button"
                  onClick={() => category && void run(window.api.files.import(name, category))}
                  disabled={!category}
                  className="h-7 rounded-md bg-accent px-2.5 text-[11px] font-medium text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  导入文件
                </button>
              )}
              <button
                type="button"
                onClick={() => void window.api.projects.reveal(name)}
                className="h-7 rounded-md border border-line bg-surface px-2.5 text-[11px] text-muted transition-colors hover:text-ink"
              >
                打开文件夹
              </button>
            </div>
          </div>

          {mode === 'files' && (
          <div className="mt-4 flex flex-wrap items-center gap-1">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                data-action={`category-${item}`}
                onClick={() => setCategory(item)}
                className={`rounded-md px-2.5 py-1 text-[12px] transition-colors ${
                  category === item
                    ? 'bg-accent-soft font-medium text-accent'
                    : 'text-muted hover:bg-surface hover:text-ink'
                }`}
              >
                {item}
                <span className="ml-1.5 text-[10px] tabular-nums opacity-60">
                  {detail?.files.filter((file) => file.category === item).length ?? 0}
                </span>
              </button>
            ))}

            {adding ? (
              <input
                autoFocus
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                onBlur={() => {
                  setAdding(false)
                  setNewCategory('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    void submitCategory()
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setAdding(false)
                    setNewCategory('')
                  }
                }}
                placeholder="分类名称"
                className="w-24 rounded-md border border-accent/40 bg-surface px-2 py-1 text-[12px] outline-none"
              />
            ) : (
              <button
                type="button"
                data-action="project-add-category"
                onClick={() => setAdding(true)}
                className="rounded-md px-2 py-1 text-[12px] text-muted/70 transition-colors hover:bg-surface hover:text-ink"
              >
                + 新建分类
              </button>
            )}
          </div>
          )}

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={(event) => {
          const next = event.relatedTarget as Node | null
          if (!next || !event.currentTarget.contains(next)) setDragOver(false)
        }}
        onDrop={(event) => void handleDrop(event)}
        className="relative min-h-0 flex-1 overflow-y-auto px-10 py-5"
      >
        <div className="mx-auto w-full max-w-[980px]">
          {mode === 'assets' ? (
            <AssetsPanel project={name} />
          ) : files.length > 0 ? (
            <ul className="space-y-0.5">
              {files.map((file: ProjectFileInfo) => (
                <li
                  key={`${file.category}/${file.name}`}
                  onDoubleClick={() =>
                    void window.api.files.open(name, file.category, file.name)
                  }
                  className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface"
                  title="双击用系统默认程序打开"
                >
                  <FileIcon className="h-4 w-4 shrink-0 text-muted/70" />
                  <span className="min-w-0 flex-1 truncate text-[13px]">{file.name}</span>
                  <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted/70">
                    {formatSize(file.size)}
                  </span>
                  <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted/70">
                    {formatModified(file.modified)}
                  </span>

                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      type="button"
                      title="在文件夹中显示"
                      onClick={() => void window.api.files.reveal(name, file.category, file.name)}
                      className="grid h-6 w-6 place-items-center rounded text-muted/70 transition-colors hover:bg-paper hover:text-ink"
                    >
                      <FolderIcon className="h-3.5 w-3.5" />
                    </button>
                    {confirming === file.name ? (
                      <button
                        type="button"
                        data-action="file-delete-confirm"
                        onClick={() =>
                          void run(window.api.files.trash(name, file.category, file.name))
                        }
                        className="rounded px-1.5 py-0.5 text-[11px] text-red-600 transition-colors hover:bg-red-50"
                      >
                        确认删除
                      </button>
                    ) : (
                      <button
                        type="button"
                        title="删除到回收站"
                        data-action="file-delete"
                        onClick={() => armConfirm(file.name)}
                        className="grid h-6 w-6 place-items-center rounded text-muted/70 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-16 text-center">
              <p className="text-sm text-muted">这个分类还没有文件</p>
              <p className="mt-1 text-xs text-muted/70">
                点右上角「导入文件」，或把文件拖到这里
              </p>
            </div>
          )}
        </div>

        {dragOver && mode === 'files' && (
          <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-dashed border-accent/50 bg-accent-soft/40">
            <div className="grid h-full place-items-center text-[13px] font-medium text-accent">
              松手导入到「{category}」
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
