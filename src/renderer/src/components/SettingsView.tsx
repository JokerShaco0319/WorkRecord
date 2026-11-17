import { useEffect, useState } from 'react'
import type { BackupInfo } from '@shared/api'

interface Props {
  vaultPath: string | null
  theme: 'light' | 'dark'
  onToggleTheme: () => void
}

const SHORTCUTS: Array<{ keys: string; description: string }> = [
  { keys: 'Ctrl + K', description: '打开全文搜索' },
  { keys: 'Ctrl + Shift + Space', description: '打开快速记录窗口' },
  { keys: '@', description: '联想并插入项目' },
  { keys: '#', description: '联想并插入标签' },
  { keys: 'Tab / Enter', description: '确认联想候选项' },
  { keys: 'Tab', description: '在加密资产表单中跳到下一个输入框（备注需点击进入）' },
  { keys: 'Enter', description: '在加密资产字段中新建一个字段' },
  { keys: '双击字段', description: '复制该字段内容' },
  { keys: '双击名称', description: '复制整条加密资产' }
]

export default function SettingsView({ vaultPath, theme, onToggleTheme }: Props) {
  const [seconds, setSeconds] = useState(12)
  const [launchAtLogin, setLaunchAtLogin] = useState(false)
  const [reminderEnabled, setReminderEnabled] = useState(true)
  const [reminderTime, setReminderTime] = useState('18:00')
  const [backups, setBackups] = useState<BackupInfo[] | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    window.api.settings
      .get()
      .then((settings) => {
        setSeconds(settings.secretClearSeconds)
        setLaunchAtLogin(settings.launchAtLogin)
        setReminderEnabled(settings.backupReminderEnabled)
        setReminderTime(settings.backupReminderTime)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    window.api.backups
      .list()
      .then(setBackups)
      .catch(() => setBackups([]))
  }, [])

  async function saveSeconds(): Promise<void> {
    try {
      const settings = await window.api.settings.setSecretClearSeconds(seconds)
      setSeconds(settings.secretClearSeconds)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function toggleLaunchAtLogin(enabled: boolean): Promise<void> {
    try {
      const settings = await window.api.settings.setLaunchAtLogin(enabled)
      setLaunchAtLogin(settings.launchAtLogin)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function restore(date: string): Promise<void> {
    try {
      const count = await window.api.backups.restore(date)
      setNotice(count > 0 ? `已从 ${date} 的备份恢复 ${count} 个文件` : '已取消恢复')
      setBackups(await window.api.backups.list())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function createBackup(): Promise<void> {
    try {
      const count = await window.api.backups.create()
      setNotice(`已备份 ${count} 个文件`)
      setBackups(await window.api.backups.list())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function saveReminder(enabled: boolean, time: string): Promise<void> {
    try {
      const settings = await window.api.settings.setBackupReminder(enabled, time)
      setReminderEnabled(settings.backupReminderEnabled)
      setReminderTime(settings.backupReminderTime)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-10 pb-6 pt-10">
        <div className="mx-auto w-full max-w-[820px]">
          <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
            Settings
          </div>
          <h1 className="mt-1 text-[27px] font-semibold tracking-tight">设置</h1>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-10 pb-14">
        <div className="mx-auto w-full max-w-[820px] space-y-4">
          <section className="rounded-xl border border-line bg-surface px-5 py-4">
            <h2 className="text-[13px] font-medium">外观</h2>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[12px] text-muted">主题</span>
              <div className="flex rounded-lg border border-line bg-paper p-0.5">
                {(
                  [
                    ['light', '浅色'],
                    ['dark', '深色']
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    data-action={`settings-theme-${key}`}
                    onClick={() => {
                      if (theme !== key) onToggleTheme()
                    }}
                    className={`rounded-[6px] px-3 py-1 text-[11px] transition-colors ${
                      theme === key
                        ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0_/_0.06)]'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-surface px-5 py-4">
            <h2 className="text-[13px] font-medium">启动</h2>
            <div className="mt-3 flex items-center justify-between gap-4">
              <div>
                <div className="text-[12px] text-muted">开机自动启动</div>
                <div className="mt-0.5 text-[11px] text-muted/60">
                  启动后直接进入托盘，不弹出主窗口
                </div>
              </div>
              <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted">
                <input
                  type="checkbox"
                  checked={launchAtLogin}
                  onChange={(event) => void toggleLaunchAtLogin(event.target.checked)}
                  className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                />
                启用
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-surface px-5 py-4">
            <h2 className="text-[13px] font-medium">加密资产</h2>
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="text-[12px] text-muted">
                显示的字段与复制到剪贴板的内容，多少秒后自动清除
              </span>
              <label className="flex shrink-0 items-center gap-1 text-[12px] text-muted">
                <input
                  type="number"
                  min={1}
                  max={300}
                  value={seconds}
                  onChange={(event) => setSeconds(Number(event.target.value) || 1)}
                  onBlur={() => void saveSeconds()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      void saveSeconds()
                    }
                  }}
                  className="w-14 rounded border border-line bg-paper px-1.5 py-0.5 text-center text-[12px] outline-none focus:border-accent/50"
                />
                秒
              </label>
            </div>
          </section>

          <section className="rounded-xl border border-line bg-surface px-5 py-4">
            <h2 className="text-[13px] font-medium">快捷键与操作</h2>
            <ul className="mt-3 space-y-2">
              {SHORTCUTS.map((item) => (
                <li
                  key={`${item.keys}-${item.description}`}
                  className="flex items-baseline justify-between gap-4 text-[12px]"
                >
                  <span className="text-muted">{item.description}</span>
                  <kbd className="shrink-0 rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-[11px] text-ink/80">
                    {item.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-line bg-surface px-5 py-4">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-[13px] font-medium">备份</h2>
              <span className="text-[10px] text-muted/60">保留最近 7 份</span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="text-[12px] text-muted">
                手动生成一份当前 Markdown 记录的快照
              </span>
              <button
                type="button"
                data-action="backup-create"
                onClick={() => void createBackup()}
                className="h-7 shrink-0 rounded-md bg-accent px-2.5 text-[11px] font-medium text-white transition hover:brightness-110"
              >
                立即备份
              </button>
            </div>

            <div className="mt-3 flex items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(event) => void saveReminder(event.target.checked, reminderTime)}
                  className="h-3 w-3 accent-[var(--color-accent)]"
                />
                每天提醒我备份
              </label>
              <input
                type="time"
                value={reminderTime}
                onChange={(event) => setReminderTime(event.target.value)}
                onBlur={() => void saveReminder(reminderEnabled, reminderTime)}
                className="h-7 rounded border border-line bg-paper px-2 text-[12px] outline-none focus:border-accent/50"
              />
            </div>

            {notice && <p className="mt-2 text-[11px] text-accent">{notice}</p>}

            {backups === null ? (
              <p className="mt-3 text-[12px] text-muted">正在读取…</p>
            ) : backups.length === 0 ? (
              <p className="mt-3 text-[12px] text-muted">还没有备份。</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {backups.map((item) => (
                  <li
                    key={item.date}
                    className="flex items-center justify-between gap-3 text-[12px]"
                  >
                    <span className="text-muted">
                      {item.date}
                      <span className="ml-2 text-muted/60">{item.files} 个文件</span>
                    </span>
                    <button
                      type="button"
                      data-action="backup-restore"
                      onClick={() => void restore(item.date)}
                      className="rounded border border-line bg-paper px-2 py-0.5 text-[11px] text-muted transition-colors hover:text-ink"
                    >
                      恢复
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-line bg-surface px-5 py-4">
            <h2 className="text-[13px] font-medium">数据目录</h2>
            <div className="mt-3 flex items-center justify-between gap-4">
              <span className="min-w-0 truncate font-mono text-[11px] text-muted" title={vaultPath ?? ''}>
                {vaultPath}
              </span>
              <button
                type="button"
                onClick={() => void window.api.vault.reveal()}
                className="h-7 shrink-0 rounded-md border border-line bg-paper px-2.5 text-[11px] text-muted transition-colors hover:text-ink"
              >
                打开文件夹
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
