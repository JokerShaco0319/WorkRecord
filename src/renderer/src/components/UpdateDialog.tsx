import { useEffect, type ReactNode } from 'react'
import type { UpdateCheckResult, UpdateProgress } from '@shared/update'
import type { ReleaseNote } from '@shared/changelog'
import MarkdownPreview from './MarkdownPreview'

const SOURCE_LABEL: Record<string, string> = {
  github: 'GitHub',
  gitcode: 'GitCode'
}

function formatSize(bytes: number): string {
  if (!bytes) return '0 MB'
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function Modal({
  children,
  onClose,
  dataAction
}: {
  children: ReactNode
  onClose: () => void
  dataAction: string
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/30 p-6"
      data-action={dataAction}
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-[540px] overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_rgb(0_0_0_/_0.24)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

interface UpdateDialogProps {
  result: UpdateCheckResult
  portable: boolean
  progress: UpdateProgress | null
  downloading: boolean
  downloaded: boolean
  installing: boolean
  error: string | null
  onLater: () => void
  onSkip: () => void
  onDownload: () => void
  onCancel: () => void
  onInstall: () => void
  onOpenPage: () => void
}

export function UpdateDialog({
  result,
  portable,
  progress,
  downloading,
  downloaded,
  installing,
  error,
  onLater,
  onSkip,
  onDownload,
  onCancel,
  onInstall,
  onOpenPage
}: UpdateDialogProps) {
  const meta = [
    `当前版本 v${result.currentVersion}`,
    result.date ? `发布于 ${result.date}` : null,
    result.source ? `来源 ${SOURCE_LABEL[result.source] ?? result.source}` : null
  ]
    .filter(Boolean)
    .join(' · ')

  const percent = downloaded ? 100 : Math.floor(progress?.percent ?? 0)
  const canDownload = !portable && Boolean(result.downloadUrl)

  return (
    <Modal onClose={onLater} dataAction="update-dialog">
      <div className="border-b border-line px-6 pb-4 pt-5">
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
          Update
        </div>
        <h2 className="mt-1 text-[19px] font-semibold tracking-tight">
          发现新版本 v{result.latestVersion}
        </h2>
        <p className="mt-1.5 text-[11px] text-muted">{meta}</p>
      </div>

      <div className="max-h-[44vh] overflow-y-auto px-6 py-4">
        {result.notes ? (
          <MarkdownPreview raw={result.notes} className="text-[12.5px]" />
        ) : (
          <p className="text-[12px] text-muted">新版本没有提供更新说明。</p>
        )}
        {portable && (
          <p className="mt-3 text-[11px] text-muted">
            便携版不支持自动覆盖安装，下载后请退出应用并替换原文件。
          </p>
        )}
      </div>

      {(downloading || downloaded) && (
        <div className="px-6 pb-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-paper">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted">
            <span>
              {downloaded
                ? '下载完成，等待安装'
                : progress?.total
                  ? `${formatSize(progress.received)} / ${formatSize(progress.total)}`
                  : '正在下载…'}
            </span>
            <span>{percent}%</span>
          </div>
        </div>
      )}

      {error && <p className="px-6 pb-2 text-[11px] text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-3 border-t border-line px-6 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-action="update-skip"
            onClick={onSkip}
            className="text-[11px] text-muted transition-colors hover:text-ink"
          >
            忽略此版本
          </button>
          <button
            type="button"
            data-action="update-open-page"
            onClick={onOpenPage}
            className="text-[11px] text-muted transition-colors hover:text-ink"
          >
            打开发布页
          </button>
        </div>

        <div className="flex items-center gap-2">
          {downloading ? (
            <>
              <button
                type="button"
                data-action="update-cancel"
                onClick={onCancel}
                className="h-8 rounded-md border border-line bg-paper px-3 text-[11px] text-muted transition-colors hover:text-ink"
              >
                取消
              </button>
              <span className="h-8 rounded-md bg-accent px-3 text-[11px] font-medium leading-8 text-white opacity-70">
                下载中 {percent}%
              </span>
            </>
          ) : downloaded ? (
            <>
              <button
                type="button"
                data-action="update-later"
                onClick={onLater}
                className="h-8 rounded-md border border-line bg-paper px-3 text-[11px] text-muted transition-colors hover:text-ink"
              >
                稍后
              </button>
              <button
                type="button"
                data-action="update-install"
                disabled={installing}
                onClick={onInstall}
                className="h-8 rounded-md bg-accent px-3 text-[11px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {installing ? '正在启动…' : '立即安装'}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                data-action="update-later"
                onClick={onLater}
                className="h-8 rounded-md border border-line bg-paper px-3 text-[11px] text-muted transition-colors hover:text-ink"
              >
                稍后
              </button>
              <button
                type="button"
                data-action={canDownload ? 'update-download' : 'update-open-page-primary'}
                onClick={canDownload ? onDownload : onOpenPage}
                className="h-8 rounded-md bg-accent px-3 text-[11px] font-medium text-white transition hover:brightness-110"
              >
                {canDownload ? '下载更新' : '前往下载'}
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

interface NotesDialogProps {
  currentVersion: string
  notes: ReleaseNote[]
  onClose: () => void
}

export function NotesDialog({ currentVersion, notes, onClose }: NotesDialogProps) {
  return (
    <Modal onClose={onClose} dataAction="notes-dialog">
      <div className="border-b border-line px-6 pb-4 pt-5">
        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
          What's New
        </div>
        <h2 className="mt-1 text-[19px] font-semibold tracking-tight">
          已更新到 v{currentVersion}
        </h2>
        <p className="mt-1.5 text-[11px] text-muted">本次更新的内容如下</p>
      </div>

      <div className="max-h-[46vh] overflow-y-auto px-6 py-4">
        {notes.map((note) => (
          <section key={note.version} className="mb-5 last:mb-0">
            <div className="mb-1 flex items-baseline gap-2">
              <h3 className="text-[12px] font-medium">v{note.version}</h3>
              <span className="text-[10px] text-muted/70">{note.date}</span>
            </div>
            <MarkdownPreview raw={note.notes} className="text-[12.5px]" />
          </section>
        ))}
      </div>

      <div className="flex justify-end border-t border-line px-6 py-3">
        <button
          type="button"
          data-action="notes-close"
          onClick={onClose}
          className="h-8 rounded-md bg-accent px-3 text-[11px] font-medium text-white transition hover:brightness-110"
        >
          知道了
        </button>
      </div>
    </Modal>
  )
}
