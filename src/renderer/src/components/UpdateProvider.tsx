import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { ReleaseNote } from '@shared/changelog'
import type { UpdateCheckResult, UpdateProgress } from '@shared/update'
import { NotesDialog, UpdateDialog } from './UpdateDialog'

interface UpdateContextValue {
  currentVersion: string
  checking: boolean
  result: UpdateCheckResult | null
  checkNow: (manual?: boolean) => Promise<void>
}

const UpdateContext = createContext<UpdateContextValue>({
  currentVersion: '',
  checking: false,
  result: null,
  checkNow: async () => {}
})

export function useUpdater(): UpdateContextValue {
  return useContext(UpdateContext)
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export default function UpdateProvider({ children }: { children: ReactNode }) {
  const [currentVersion, setCurrentVersion] = useState('')
  const [portable, setPortable] = useState(false)
  const [notes, setNotes] = useState<ReleaseNote[] | null>(null)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)
  const [dialog, setDialog] = useState<UpdateCheckResult | null>(null)
  const [checking, setChecking] = useState(false)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadedPath, setDownloadedPath] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    window.api.update
      .bootstrap()
      .then((info) => {
        if (cancelled) return
        setCurrentVersion(info.currentVersion)
        setPortable(info.portable)
        if (info.notes.length > 0) setNotes(info.notes)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void checkNow(false)
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => window.api.update.onProgress((next) => setProgress(next)), [])

  function openUpdateDialog(next: UpdateCheckResult): void {
    setDialog(next)
    setProgress(null)
    setDownloading(false)
    setDownloadedPath(null)
    setInstalling(false)
    setDownloadError(null)
  }

  async function checkNow(manual = false): Promise<void> {
    setChecking(true)
    try {
      const next = await window.api.update.check(manual)
      setResult(next)
      if (next.hasUpdate && (manual || !next.skipped)) openUpdateDialog(next)
    } catch {
      // 检查失败保持静默，设置页里可以手动重试
    } finally {
      setChecking(false)
    }
  }

  async function skipVersion(): Promise<void> {
    if (!dialog?.latestVersion) return
    try {
      await window.api.update.dismiss(dialog.latestVersion)
    } catch {
      // 忽略失败不影响本次关闭
    }
    setDialog(null)
  }

  async function startDownload(): Promise<void> {
    if (!dialog?.downloadUrl || downloading) return
    setDownloading(true)
    setDownloadError(null)
    setDownloadedPath(null)
    setProgress({ received: 0, total: 0, percent: 0 })
    try {
      const file = await window.api.update.download(dialog.downloadUrl, dialog.sha256)
      setDownloadedPath(file.path)
    } catch (error) {
      setProgress(null)
      setDownloadError(messageOf(error))
    } finally {
      setDownloading(false)
    }
  }

  async function cancelDownload(): Promise<void> {
    try {
      await window.api.update.cancel()
    } catch {
      // 取消失败时保持当前状态
    }
    setDownloading(false)
    setProgress(null)
  }

  async function installUpdate(): Promise<void> {
    if (!downloadedPath || installing) return
    setInstalling(true)
    setDownloadError(null)
    try {
      await window.api.update.install(downloadedPath)
    } catch (error) {
      setInstalling(false)
      setDownloadError(messageOf(error))
    }
  }

  async function closeDialog(): Promise<void> {
    if (downloading) await cancelDownload()
    setDialog(null)
  }

  async function openReleasePage(): Promise<void> {
    const url = dialog?.downloadUrl ?? dialog?.releasePage
    if (!url) return
    try {
      await window.api.update.open(url)
    } catch {
      // 打开失败时保留弹窗
    }
  }

  return (
    <UpdateContext.Provider value={{ currentVersion, checking, result, checkNow }}>
      {children}

      {dialog && (
        <UpdateDialog
          result={dialog}
          portable={portable}
          progress={progress}
          downloading={downloading}
          downloaded={Boolean(downloadedPath)}
          installing={installing}
          error={downloadError}
          onLater={() => void closeDialog()}
          onSkip={() => void skipVersion()}
          onDownload={() => void startDownload()}
          onCancel={() => void cancelDownload()}
          onInstall={() => void installUpdate()}
          onOpenPage={() => void openReleasePage()}
        />
      )}

      {notes && (
        <NotesDialog
          currentVersion={currentVersion}
          notes={notes}
          onClose={() => setNotes(null)}
        />
      )}
    </UpdateContext.Provider>
  )
}
