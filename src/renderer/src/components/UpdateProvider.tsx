import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { UpdateCheckResult } from '@shared/update'
import type { ReleaseNote } from '@shared/changelog'
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

export default function UpdateProvider({ children }: { children: ReactNode }) {
  const [currentVersion, setCurrentVersion] = useState('')
  const [notes, setNotes] = useState<ReleaseNote[] | null>(null)
  const [result, setResult] = useState<UpdateCheckResult | null>(null)
  const [updateDialog, setUpdateDialog] = useState<UpdateCheckResult | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    let cancelled = false
    window.api.update
      .bootstrap()
      .then((info) => {
        if (cancelled) return
        setCurrentVersion(info.currentVersion)
        if (info.notes.length > 0) setNotes(info.notes)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    // 延迟检查，避免和启动加载争抢网络与主线程
    const timer = window.setTimeout(() => {
      void checkNow(false)
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [])

  async function checkNow(manual = false): Promise<void> {
    setChecking(true)
    try {
      const next = await window.api.update.check(manual)
      setResult(next)
      if (next.hasUpdate && (manual || !next.skipped)) setUpdateDialog(next)
    } catch {
      // 检查失败保持静默，设置页里可以手动重试
    } finally {
      setChecking(false)
    }
  }

  async function skipVersion(): Promise<void> {
    if (!updateDialog?.latestVersion) return
    try {
      await window.api.update.dismiss(updateDialog.latestVersion)
    } catch {
      // 忽略失败不影响本次关闭
    }
    setUpdateDialog(null)
  }

  async function openDownload(): Promise<void> {
    const url = updateDialog?.downloadUrl ?? updateDialog?.releasePage
    if (!url) return
    try {
      await window.api.update.open(url)
    } catch {
      // 下载页打开失败时保留弹窗，用户可以再试
    }
  }

  return (
    <UpdateContext.Provider value={{ currentVersion, checking, result, checkNow }}>
      {children}

      {updateDialog && (
        <UpdateDialog
          result={updateDialog}
          onLater={() => setUpdateDialog(null)}
          onSkip={() => void skipVersion()}
          onDownload={() => void openDownload()}
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
