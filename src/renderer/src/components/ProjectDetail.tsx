import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  ArchiveEntry,
  ProjectDetail as ProjectDetailData,
  ProjectFileInfo
} from '@shared/api'
import type { ProjectStatus } from '@shared/md/project'
import AssetsPanel from './AssetsPanel'
import FileTree from './FileTree'
import {
  ArchiveIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  PencilIcon,
  TrashIcon
} from './icons'

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

function parentOf(value: string): string {
  return value.includes('/') ? value.slice(0, value.lastIndexOf('/')) : ''
}

function baseName(value: string): string {
  return value.includes('/') ? value.slice(value.lastIndexOf('/') + 1) : value
}

export default function ProjectDetail({ name, onBack }: Props) {
  const [detail, setDetail] = useState<ProjectDetailData | null>(null)
  const [category, setCategory] = useState<string | null>(null)
  const [mode, setMode] = useState<'files' | 'assets' | 'archived'>('files')
  const [error, setError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [renamingFile, setRenamingFile] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [movingFile, setMovingFile] = useState<string | null>(null)
  const [path, setPath] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null)
  const [folderRenameValue, setFolderRenameValue] = useState('')
  const [archived, setArchived] = useState<ArchiveEntry[]>([])
  const [archivedLoading, setArchivedLoading] = useState(false)
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

  const loadArchived = useCallback(async () => {
    setArchivedLoading(true)
    try {
      setArchived(await window.api.files.listArchived(name))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setArchivedLoading(false)
    }
  }, [name])

  useEffect(() => {
    if (mode === 'archived') void loadArchived()
  }, [mode, loadArchived])

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

  async function changeStatus(status: ProjectStatus): Promise<void> {
    try {
      setDetail(await window.api.projects.setStatus(name, status))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function startRename(file: ProjectFileInfo): void {
    setRenamingFile(file.path)
    setRenameValue(file.name)
    setMovingFile(null)
  }

  async function submitRename(file: ProjectFileInfo): Promise<void> {
    const target = renameValue.trim()
    setRenamingFile(null)
    if (!target || target === file.name) return

    try {
      setDetail(await window.api.files.rename(name, file.category, file.path, target))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function moveTo(file: ProjectFileInfo, toCategory: string): Promise<void> {
    setMovingFile(null)
    if (toCategory === file.category) return

    try {
      setDetail(await window.api.files.move(name, file.category, file.path, toCategory))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function archiveItem(file: ProjectFileInfo): Promise<void> {
    try {
      setDetail(await window.api.files.archive(name, file.category, file.path))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function archiveFolderItem(folder: string): Promise<void> {
    if (!category) return
    try {
      setDetail(await window.api.files.archiveFolder(name, category, folder))
      if (path === folder || path.startsWith(`${folder}/`)) setPath('')
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function restoreArchivedItem(entry: ArchiveEntry): Promise<void> {
    try {
      setArchived(await window.api.files.restoreArchived(name, entry.id))
      await load()
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function trashArchivedItem(entry: ArchiveEntry): Promise<void> {
    try {
      setArchived(await window.api.files.trashArchived(name, entry.id))
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
      setPath('')
      setNewCategory('')
      setAdding(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function submitFolder(): Promise<void> {
    const value = folderName.trim()
    if (!value || !category) return

    try {
      setDetail(await window.api.files.createFolder(name, category, path, value))
      setFolderName('')
      setCreatingFolder(false)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  function startFolderRename(folder: string): void {
    setRenamingFolder(folder)
    setFolderRenameValue(baseName(folder))
  }

  async function submitFolderRename(folder: string): Promise<void> {
    if (!category) return

    const target = folderRenameValue.trim()
    setRenamingFolder(null)
    if (!target || target === baseName(folder)) return

    try {
      setDetail(await window.api.files.renameFolder(name, category, folder, target))

      // 当前所在目录可能就在被重命名的目录里
      if (path === folder || path.startsWith(`${folder}/`)) {
        const parent = parentOf(folder)
        const rest = path.slice(folder.length)
        setPath(parent ? `${parent}/${target}${rest}` : `${target}${rest}`)
      }
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function handleDrop(event: React.DragEvent): Promise<void> {
    event.preventDefault()
    setDragOver(false)
    if (mode !== 'files' || !category) return

    const sourcePaths: string[] = []
    for (const file of Array.from(event.dataTransfer.files)) {
      try {
        const filePath = window.api.files.pathOf(file)
        if (filePath) sourcePaths.push(filePath)
      } catch {
        // 非本地文件忽略
      }
    }
    if (sourcePaths.length === 0) return

    await run(window.api.files.importPaths(name, category, path, sourcePaths))
  }

  function armConfirm(key: string): void {
    setConfirming(key)
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
    confirmTimer.current = window.setTimeout(() => setConfirming(null), 3000)
  }

  const categories = detail?.categories ?? []
  const categoryFiles = detail?.files.filter((file) => file.category === category) ?? []
  const categoryFolders =
    detail?.folders.filter((folder) => folder.category === category).map((folder) => folder.path) ??
    []

  const visibleFolders = categoryFolders.filter((folder) => parentOf(folder) === path)
  const visibleFiles = categoryFiles.filter((file) => parentOf(file.path) === path)
  const breadcrumbs = path
    ? path.split('/').map((label, index, all) => ({
        name: label,
        path: all.slice(0, index + 1).join('/')
      }))
    : []

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-line/60 px-10 pt-8 pb-3">
        <div className="mx-auto w-full max-w-[1120px]">
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
              <div className="flex items-center gap-2">
                <h1 className="truncate text-[22px] font-semibold tracking-tight">
                  {detail?.name ?? name}
                </h1>
                <select
                  value={detail?.status ?? 'active'}
                  onChange={(event) => void changeStatus(event.target.value as ProjectStatus)}
                  className="shrink-0 rounded-md border border-line bg-surface px-1.5 py-0.5 text-[11px] text-muted outline-none focus:border-accent/50"
                >
                  <option value="active">进行中</option>
                  <option value="paused">暂停</option>
                  <option value="archived">已归档</option>
                </select>
              </div>
              <p className="mt-1 line-clamp-2 text-[12px] text-muted">
                {detail?.description || '暂无描述'}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <div className="flex rounded-lg border border-line bg-paper p-0.5">
                {(
                  [
                    ['files', '文件'],
                    ['assets', '加密资产'],
                    ['archived', '归档']
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
                  onClick={() => category && void run(window.api.files.import(name, category, path))}
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
                  onClick={() => {
                    setCategory(item)
                    setPath('')
                  }}
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
        className="relative min-h-0 flex-1 px-10 py-5"
      >
        <div className="mx-auto flex h-full w-full max-w-[1120px] gap-4">
          <div className="min-w-0 flex-1 overflow-y-auto pb-4">
            {mode === 'assets' ? (
              <AssetsPanel project={name} />
            ) : mode === 'archived' ? (
              <div>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-[12px] text-muted">
                    {archivedLoading ? '正在读取…' : `共 ${archived.length} 个归档记录`}
                  </p>
                </div>

                {!archivedLoading && archived.length === 0 ? (
                  <div className="mt-16 text-center">
                    <p className="text-sm text-muted">还没有归档记录</p>
                    <p className="mt-1 text-xs text-muted/70">
                      归档文件时会自动带上文档里的相对链接资产
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {archived.map((entry) => (
                      <li
                        key={entry.id}
                        className="rounded-lg px-3 py-2 transition-colors hover:bg-surface"
                      >
                        <div className="flex items-center gap-3">
                          {entry.kind === 'folder' ? (
                            <FolderIcon className="h-4 w-4 shrink-0 text-muted/70" />
                          ) : (
                            <FileIcon className="h-4 w-4 shrink-0 text-muted/70" />
                          )}
                          <div
                            className="min-w-0 flex-1"
                            title={entry.kind === 'file' ? '双击用系统默认程序打开' : ''}
                            onDoubleClick={() => {
                              const file = entry.files[0]
                              if (entry.kind === 'file' && file) {
                                void window.api.files.openArchived(name, entry.id, file.path)
                              }
                            }}
                          >
                            <div className="truncate text-[13px]">{entry.name}</div>
                            <div className="truncate text-[11px] text-muted/60">
                              {entry.root}
                              {entry.kind === 'folder' ? ` · ${entry.files.length} 个文件` : ''}
                              {entry.legacy ? ' · 旧版归档' : ''}
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted/60">
                            {formatModified(entry.archivedAt)}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <button
                              type="button"
                              data-action="archived-restore"
                              onClick={() => void restoreArchivedItem(entry)}
                              className="h-6 rounded px-1.5 text-[11px] text-accent transition-colors hover:bg-accent-soft"
                            >
                              恢复
                            </button>
                            <button
                              type="button"
                              title="删除到回收站"
                              data-action="archived-delete"
                              onClick={() => void trashArchivedItem(entry)}
                              className="grid h-6 w-6 place-items-center rounded text-muted/70 transition-colors hover:bg-red-50 hover:text-red-600"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {entry.kind === 'file' && entry.files[0] && (
                          <div className="ml-7 mt-0.5 flex items-center gap-3 text-[11px] text-muted/60">
                            <span>{formatSize(entry.files[0].size)}</span>
                            <span>{formatModified(entry.files[0].modified)}</span>
                            {entry.files.length > 1 && (
                              <span>含 {entry.files.length - 1} 个关联文件</span>
                            )}
                          </div>
                        )}

                        {entry.kind === 'folder' && entry.files.length > 0 && (
                          <ul className="ml-7 mt-1 space-y-0.5">
                            {entry.files.map((file) => (
                              <li
                                key={file.path}
                                className="group flex items-center gap-2 rounded px-2 py-1 hover:bg-paper"
                              >
                                <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted/60" />
                                <span
                                  className="min-w-0 flex-1 truncate text-[12px] text-muted"
                                  title="双击用系统默认程序打开"
                                  onDoubleClick={() =>
                                    void window.api.files.openArchived(name, entry.id, file.path)
                                  }
                                >
                                  {file.path}
                                </span>
                                <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted/60">
                                  {formatSize(file.size)}
                                </span>
                                <button
                                  type="button"
                                  title="在文件夹中显示"
                                  data-action="archived-reveal"
                                  onClick={() =>
                                    void window.api.files.revealArchived(
                                      name,
                                      entry.id,
                                      file.path
                                    )
                                  }
                                  className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted/70 transition-colors hover:bg-paper hover:text-ink"
                                >
                                  <FolderIcon className="h-3.5 w-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-1 text-[12px]">
                    <button
                      type="button"
                      onClick={() => setPath('')}
                      className={`rounded px-1 py-0.5 transition-colors ${
                        path ? 'text-muted hover:text-ink' : 'font-medium text-ink'
                      }`}
                    >
                      {category ?? '分类'}
                    </button>
                    {breadcrumbs.map((crumb) => (
                      <span key={crumb.path} className="flex items-center gap-1">
                        <span className="text-muted/40">/</span>
                        <button
                          type="button"
                          onClick={() => setPath(crumb.path)}
                          className={`rounded px-1 py-0.5 transition-colors ${
                            crumb.path === path
                              ? 'font-medium text-ink'
                              : 'text-muted hover:text-ink'
                          }`}
                        >
                          {crumb.name}
                        </button>
                      </span>
                    ))}
                  </div>

                  {creatingFolder ? (
                    <input
                      autoFocus
                      value={folderName}
                      onChange={(event) => setFolderName(event.target.value)}
                      onBlur={() => {
                        setCreatingFolder(false)
                        setFolderName('')
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                          event.preventDefault()
                          void submitFolder()
                        }
                        if (event.key === 'Escape') {
                          event.preventDefault()
                          setCreatingFolder(false)
                          setFolderName('')
                        }
                      }}
                      placeholder="目录名称"
                      className="h-7 w-32 rounded-md border border-accent/40 bg-surface px-2 text-[12px] outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      data-action="file-new-folder"
                      onClick={() => setCreatingFolder(true)}
                      className="h-7 shrink-0 rounded-md border border-line bg-surface px-2.5 text-[11px] text-muted transition-colors hover:text-ink"
                    >
                      + 新建目录
                    </button>
                  )}
                </div>

                {visibleFolders.length === 0 && visibleFiles.length === 0 ? (
                  <div className="mt-16 text-center">
                    <p className="text-sm text-muted">这个目录还是空的</p>
                    <p className="mt-1 text-xs text-muted/70">
                      新建目录整理文件，或把文件拖到这里
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-0.5">
                    {visibleFolders.map((folder) => {
                      const count = categoryFiles.filter((file) =>
                        file.path.startsWith(`${folder}/`)
                      ).length

                      return (
                        <li
                          key={`folder-${folder}`}
                          className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface"
                        >
                          <FolderIcon className="h-4 w-4 shrink-0 text-muted/70" />

                          {renamingFolder === folder ? (
                            <input
                              autoFocus
                              value={folderRenameValue}
                              onChange={(event) => setFolderRenameValue(event.target.value)}
                              onBlur={() => void submitFolderRename(folder)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                                  event.preventDefault()
                                  void submitFolderRename(folder)
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  setRenamingFolder(null)
                                }
                              }}
                              className="min-w-0 flex-1 rounded border border-accent/50 bg-paper px-2 py-0.5 text-[13px] outline-none"
                            />
                          ) : (
                            <button
                              type="button"
                              data-action="folder-open"
                              onClick={() => setPath(folder)}
                              className="min-w-0 flex-1 truncate text-left text-[13px]"
                            >
                              {baseName(folder)}
                            </button>
                          )}

                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted/60">
                            {count} 个文件
                          </span>

                          {renamingFolder !== folder && (
                            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                              <button
                                type="button"
                                title="归档目录"
                                data-action="folder-archive"
                                onClick={() => void archiveFolderItem(folder)}
                                className="grid h-6 w-6 place-items-center rounded text-muted/70 transition-colors hover:bg-paper hover:text-ink"
                              >
                                <ArchiveIcon className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="重命名目录"
                                data-action="folder-rename"
                                onClick={() => startFolderRename(folder)}
                                className="grid h-6 w-6 place-items-center rounded text-muted/70 transition-colors hover:bg-paper hover:text-ink"
                              >
                                <PencilIcon className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </li>
                      )
                    })}

                    {visibleFiles.map((file) => {
                      const isRenaming = renamingFile === file.path
                      const isMoving = movingFile === file.path

                      return (
                        <li
                          key={`file-${file.path}`}
                          onDoubleClick={() => {
                            if (!isRenaming) {
                              void window.api.files.open(name, file.category, file.path)
                            }
                          }}
                          className="group flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface"
                          title="双击用系统默认程序打开"
                        >
                          <FileIcon className="h-4 w-4 shrink-0 text-muted/70" />

                          {isRenaming ? (
                            <input
                              autoFocus
                              value={renameValue}
                              onChange={(event) => setRenameValue(event.target.value)}
                              onBlur={() => void submitRename(file)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                                  event.preventDefault()
                                  void submitRename(file)
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault()
                                  setRenamingFile(null)
                                }
                              }}
                              className="min-w-0 flex-1 rounded border border-accent/50 bg-paper px-2 py-0.5 text-[13px] outline-none"
                            />
                          ) : (
                            <span className="min-w-0 flex-1 truncate text-[13px]">
                              {file.name}
                            </span>
                          )}

                          <span className="w-16 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted/70">
                            {formatSize(file.size)}
                          </span>
                          <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted/70">
                            {formatModified(file.modified)}
                          </span>

                          <div
                            className={`relative flex shrink-0 items-center gap-0.5 transition-opacity group-hover:opacity-100 focus-within:opacity-100 ${
                              isMoving ? 'opacity-100' : 'opacity-0'
                            }`}
                          >
                            <button
                              type="button"
                              title="在文件夹中显示"
                              onClick={() =>
                                void window.api.files.reveal(name, file.category, file.path)
                              }
                              className="grid h-6 w-6 place-items-center rounded text-muted/70 transition-colors hover:bg-paper hover:text-ink"
                            >
                              <FolderIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="归档"
                              data-action="file-archive"
                              onClick={() => void archiveItem(file)}
                              className="grid h-6 w-6 place-items-center rounded text-muted/70 transition-colors hover:bg-paper hover:text-ink"
                            >
                              <ArchiveIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="重命名"
                              data-action="file-rename"
                              onClick={() => startRename(file)}
                              className="grid h-6 w-6 place-items-center rounded text-muted/70 transition-colors hover:bg-paper hover:text-ink"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              title="移动到其它分类"
                              data-action="file-move"
                              onClick={() => setMovingFile(isMoving ? null : file.path)}
                              className="grid h-6 w-6 place-items-center rounded text-muted/70 transition-colors hover:bg-paper hover:text-ink"
                            >
                              <ChevronRightIcon className="h-3.5 w-3.5" />
                            </button>

                            {confirming === file.path ? (
                              <button
                                type="button"
                                data-action="file-delete-confirm"
                                onClick={() =>
                                  void run(
                                    window.api.files.trash(name, file.category, file.path)
                                  )
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
                                onClick={() => armConfirm(file.path)}
                                className="grid h-6 w-6 place-items-center rounded text-muted/70 transition-colors hover:bg-red-50 hover:text-red-600"
                              >
                                <TrashIcon className="h-3.5 w-3.5" />
                              </button>
                            )}

                            {isMoving && (
                              <div className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-lg border border-line bg-surface shadow-[0_8px_24px_rgb(0_0_0_/_0.12)]">
                                {categories.filter((item) => item !== file.category).length > 0 ? (
                                  categories
                                    .filter((item) => item !== file.category)
                                    .map((item) => (
                                      <button
                                        key={item}
                                        type="button"
                                        data-action="file-move-target"
                                        onClick={() => void moveTo(file, item)}
                                        className="block w-full px-3 py-1.5 text-left text-[12px] transition-colors hover:bg-paper"
                                      >
                                        {item}
                                      </button>
                                    ))
                                ) : (
                                  <div className="px-3 py-1.5 text-[11px] text-muted/60">
                                    没有其它分类
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </>
            )}
          </div>

          {mode === 'files' && category && (
            <aside className="hidden w-[240px] shrink-0 overflow-y-auto rounded-xl border border-line bg-surface px-3 py-3 lg:block">
              <FileTree
                folders={categoryFolders}
                files={categoryFiles}
                currentPath={path}
                onSelectFolder={setPath}
                onOpenFile={(file) =>
                  void window.api.files.open(name, file.category, file.path)
                }
              />
            </aside>
          )}
        </div>

        {dragOver && mode === 'files' && (
          <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-dashed border-accent/50 bg-accent-soft/40">
            <div className="grid h-full place-items-center text-[13px] font-medium text-accent">
              松手导入到「{path ? `${category} / ${path}` : category}」
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
