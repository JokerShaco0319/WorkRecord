import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'
import type { Asset, AssetField, SecurityStatus } from '@shared/api'

let counter = 0
function newId(): string {
  counter += 1
  return `local-${Date.now()}-${counter}`
}

function blankAsset(): Asset {
  return {
    id: '',
    title: '',
    fields: [{ id: newId(), label: '', value: '', secret: true }],
    notes: '',
    updatedAt: ''
  }
}

export default function AssetsPanel({ project }: { project: string }) {
  const [status, setStatus] = useState<SecurityStatus | null>(null)
  const [assets, setAssets] = useState<Asset[]>([])
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<Asset | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)
  const [clearSeconds, setClearSeconds] = useState(12)
  const revealTimers = useRef(new Map<string, number>())

  const loadAssets = useCallback(async () => {
    setAssets(await window.api.assets.list(project))
  }, [project])

  useEffect(() => {
    let cancelled = false

    window.api.security
      .status()
      .then(async (next) => {
        if (cancelled) return
        setStatus(next)
        if (next.unlocked) {
          const items = await window.api.assets.list(project)
          if (!cancelled) setAssets(items)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
    }
  }, [project])

  useEffect(() => {
    window.api.settings
      .get()
      .then((settings) => setClearSeconds(settings.secretClearSeconds))
      .catch(() => {})
  }, [])

  useEffect(() => {
    const timers = revealTimers.current
    return () => {
      for (const timer of timers.values()) window.clearTimeout(timer)
      timers.clear()
    }
  }, [])

  function addField(): void {
    if (!draft) return

    const id = newId()
    setDraft({ ...draft, fields: [...draft.fields, { id, label: '', value: '', secret: true }] })
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>(`[data-field-label="${id}"]`)?.focus()
    })
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement
    if (!target.hasAttribute('data-asset-input')) return

    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault()
      addField()
      return
    }

    if (event.key !== 'Tab') return

    const container = event.currentTarget
    const inputs = Array.from(container.querySelectorAll<HTMLElement>('[data-asset-input]'))
    const index = inputs.indexOf(target)
    if (index === -1) return

    const next = event.shiftKey ? inputs[index - 1] : inputs[index + 1]
    if (next) {
      event.preventDefault()
      next.focus()
      return
    }

    // 走过最后一个字段后跳到保存，备注只接受鼠标点击
    if (!event.shiftKey && index === inputs.length - 1) {
      event.preventDefault()
      container.querySelector<HTMLButtonElement>('[data-action="asset-save"]')?.focus()
    }
  }

  function assetText(asset: Asset): string {
    const lines = asset.fields
      .filter((field) => field.value.trim())
      .map((field) => `${field.label || '字段'}: ${field.value}`)
    if (asset.notes.trim()) lines.push(asset.notes.trim())
    return lines.join('\n')
  }

  async function setup(): Promise<void> {
    if (password !== confirm) {
      setError('两次输入的主密码不一致')
      return
    }
    setBusy(true)
    try {
      setStatus(await window.api.security.setup(password))
      setPassword('')
      setConfirm('')
      setError(null)
      await loadAssets()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function unlock(): Promise<void> {
    setBusy(true)
    try {
      setStatus(await window.api.security.unlock(password))
      setPassword('')
      setError(null)
      await loadAssets()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function lock(): Promise<void> {
    try {
      for (const timer of revealTimers.current.values()) window.clearTimeout(timer)
      revealTimers.current.clear()

      setStatus(await window.api.security.lock())
      setAssets([])
      setDraft(null)
      setRevealed(new Set())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function saveDraft(): Promise<void> {
    if (!draft) return
    if (!draft.title.trim()) {
      setError('请填写名称')
      return
    }
    try {
      setAssets(await window.api.assets.save(project, { ...draft, title: draft.title.trim() }))
      setDraft(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function remove(id: string): Promise<void> {
    try {
      setAssets(await window.api.assets.remove(project, id))
      setConfirmingId(null)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  async function copy(value: string, key: string): Promise<void> {
    await window.api.assets.copy(value)
    setCopied(key)
    window.setTimeout(() => setCopied(null), 1500)
  }

  function updateField(fieldId: string, patch: Partial<AssetField>): void {
    setDraft((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((field) =>
              field.id === fieldId ? { ...field, ...patch } : field
            )
          }
        : current
    )
  }

  function toggleReveal(fieldId: string): void {
    const timers = revealTimers.current
    const existing = timers.get(fieldId)
    if (existing) {
      window.clearTimeout(existing)
      timers.delete(fieldId)
    }

    const isRevealed = revealed.has(fieldId)
    const next = new Set(revealed)
    if (isRevealed) next.delete(fieldId)
    else next.add(fieldId)
    setRevealed(next)

    if (!isRevealed) {
      timers.set(
        fieldId,
        window.setTimeout(() => {
          setRevealed((current) => {
            const after = new Set(current)
            after.delete(fieldId)
            return after
          })
          timers.delete(fieldId)
        }, Math.max(1, clearSeconds) * 1000)
      )
    }
  }

  if (!status) {
    return <div className="text-[12px] text-muted">正在读取加密状态…</div>
  }

  return (
    <div>
      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {!status.configured && (
        <div className="mx-auto max-w-[420px] rounded-xl border border-line bg-surface p-5">
          <h2 className="text-[14px] font-medium">设置主密码</h2>
          <p className="mt-2 text-[12px] leading-5 text-muted">
            加密资产会用这个密码派生的密钥加密后存放在项目目录下。密码只保存在内存里，退出应用后需要重新输入。
          </p>
          <p className="mt-2 rounded-md bg-red-50 px-2.5 py-1.5 text-[11px] leading-4 text-red-700">
            忘记主密码后，加密内容无法恢复。没有找回或重置的途径。
          </p>

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="主密码（至少 6 位）"
            className="mt-4 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent/50"
          />
          <input
            type="password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) void setup()
            }}
            placeholder="再次输入主密码"
            className="mt-2 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent/50"
          />
          <button
            type="button"
            onClick={() => void setup()}
            disabled={busy}
            className="mt-3 h-8 w-full rounded-lg bg-accent text-[12px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            设置主密码
          </button>
        </div>
      )}

      {status.configured && !status.unlocked && (
        <div className="mx-auto max-w-[420px] rounded-xl border border-line bg-surface p-5">
          <h2 className="text-[14px] font-medium">解锁加密资产</h2>
          <p className="mt-2 text-[12px] text-muted">输入主密码后查看和编辑加密内容。</p>
          <input
            autoFocus
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) void unlock()
            }}
            placeholder="主密码"
            className="mt-3 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-accent/50"
          />
          <button
            type="button"
            onClick={() => void unlock()}
            disabled={busy}
            className="mt-3 h-8 w-full rounded-lg bg-accent text-[12px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            解锁
          </button>
        </div>
      )}

      {status.unlocked && (
        <>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] text-muted">{assets.length} 条加密记录</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                data-action="asset-new"
                onClick={() => {
                  setDraft(blankAsset())
                  setError(null)
                }}
                className="h-7 rounded-md bg-accent px-2.5 text-[11px] font-medium text-white transition hover:brightness-110"
              >
                新增
              </button>
              <button
                type="button"
                onClick={() => void lock()}
                className="h-7 rounded-md border border-line bg-surface px-2.5 text-[11px] text-muted transition-colors hover:text-ink"
              >
                锁定
              </button>
            </div>
          </div>

          {draft && (
            <div
              className="mb-3 rounded-xl border border-accent/40 bg-surface p-4"
              onKeyDown={handleEditorKeyDown}
            >
              <input
                autoFocus
                data-asset-input
                value={draft.title}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="名称，例如：服务器账号"
                className="w-full rounded-md border border-line bg-paper px-2.5 py-1.5 text-[13px] outline-none focus:border-accent/50"
              />

              <div className="mt-2 space-y-1.5">
                {draft.fields.map((field) => (
                  <div key={field.id} className="flex items-center gap-1.5">
                    <input
                      data-asset-input
                      data-field-label={field.id}
                      value={field.label}
                      onChange={(event) => updateField(field.id, { label: event.target.value })}
                      placeholder="字段名"
                      className="w-24 shrink-0 rounded-md border border-line bg-paper px-2 py-1 text-[12px] outline-none focus:border-accent/50"
                    />
                    <input
                      data-asset-input
                      value={field.value}
                      onChange={(event) => updateField(field.id, { value: event.target.value })}
                      placeholder="内容"
                      className="min-w-0 flex-1 rounded-md border border-line bg-paper px-2 py-1 text-[12px] outline-none focus:border-accent/50"
                    />
                    <label
                      title="勾选后，保存的内容在资产列表中显示为圆点，点「显示」才能看到"
                      className="flex shrink-0 items-center gap-1 text-[11px] text-muted"
                    >
                      <input
                        type="checkbox"
                        checked={field.secret}
                        onChange={(event) =>
                          updateField(field.id, { secret: event.target.checked })
                        }
                        className="h-3 w-3 accent-[var(--color-accent)]"
                      />
                      保存后隐藏
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          fields: draft.fields.filter((item) => item.id !== field.id)
                        })
                      }
                      className="shrink-0 text-[11px] text-muted/70 transition-colors hover:text-red-600"
                    >
                      移除
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => addField()}
                className="mt-2 text-[11px] text-accent transition-opacity hover:opacity-70"
              >
                + 添加字段
              </button>

              <textarea
                value={draft.notes}
                onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                placeholder="备注（可选）"
                rows={2}
                className="mt-2 w-full resize-none rounded-md border border-line bg-paper px-2.5 py-1.5 text-[12px] outline-none focus:border-accent/50"
              />

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  data-action="asset-save"
                  onClick={() => void saveDraft()}
                  className="h-7 rounded-md bg-accent px-3 text-[11px] font-medium text-white transition hover:brightness-110"
                >
                  保存
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(null)
                    setError(null)
                  }}
                  className="h-7 rounded-md px-2 text-[11px] text-muted transition-colors hover:text-ink"
                >
                  取消
                </button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            {assets.map((asset) => (
              <div key={asset.id} className="rounded-xl border border-line bg-surface p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-baseline gap-2">
                    <span
                      onDoubleClick={() => void copy(assetText(asset), `${asset.id}-all`)}
                      title="双击复制整条资产"
                      className="truncate text-[13px] font-medium"
                    >
                      {asset.title}
                    </span>
                    {copied === `${asset.id}-all` && (
                      <span className="shrink-0 text-[10px] text-accent">已复制</span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDraft({ ...asset, fields: asset.fields.map((f) => ({ ...f })) })
                        setError(null)
                      }}
                      className="text-[11px] text-muted transition-colors hover:text-ink"
                    >
                      编辑
                    </button>
                    {confirmingId === asset.id ? (
                      <button
                        type="button"
                        onClick={() => void remove(asset.id)}
                        className="text-[11px] text-red-600"
                      >
                        确认删除
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmingId(asset.id)}
                        className="text-[11px] text-muted transition-colors hover:text-red-600"
                      >
                        删除
                      </button>
                    )}
                  </div>
                </div>

                {asset.fields.length > 0 && (
                  <dl className="mt-2 space-y-1">
                    {asset.fields.map((field) => (
                      <div
                        key={field.id}
                        onDoubleClick={() => void copy(field.value, field.id)}
                        title="双击复制该字段"
                        className="flex flex-col gap-0.5 text-[12px] sm:flex-row sm:items-center sm:gap-2"
                      >
                        <dt className="shrink-0 truncate text-muted sm:w-16">
                          {field.label || '未命名字段'}
                        </dt>
                        <dd className="min-w-0 flex-1 truncate font-mono">
                          {field.secret && !revealed.has(field.id) ? '••••••••' : field.value}
                        </dd>
                        {field.secret && (
                          <button
                            type="button"
                            onClick={() => toggleReveal(field.id)}
                            className="shrink-0 text-[11px] text-muted transition-colors hover:text-ink"
                          >
                            {revealed.has(field.id) ? '隐藏' : '显示'}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void copy(field.value, field.id)}
                          className="shrink-0 text-[11px] text-accent transition-opacity hover:opacity-70"
                        >
                          {copied === field.id ? '已复制' : '复制'}
                        </button>
                      </div>
                    ))}
                  </dl>
                )}

                {asset.notes && (
                  <p className="mt-2 whitespace-pre-wrap text-[12px] leading-5 text-muted">
                    {asset.notes}
                  </p>
                )}
              </div>
            ))}

            {assets.length === 0 && !draft && (
              <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center">
                <p className="text-[13px] text-muted">还没有加密记录</p>
                <p className="mt-1 text-[11px] text-muted/70">
                  点右上角「新增」，保存密码、账号或地址
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
