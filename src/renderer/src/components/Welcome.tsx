import { useState } from 'react'
import type { VaultInfo } from '@shared/api'

export default function Welcome({ onReady }: { onReady: (vault: VaultInfo) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function choose(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      onReady(await window.api.vault.choose())
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full items-center justify-center px-8">
      <div className="w-full max-w-[400px] text-center">
        <div className="mb-7 inline-grid h-11 w-11 place-items-center rounded-xl bg-accent text-lg font-semibold text-white">
          W
        </div>
        <h1 className="text-[26px] font-semibold tracking-tight">WorkRecord</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          每天记几笔，周末自动汇总。
          <br />
          所有内容都以 Markdown 保存在你选择的目录里。
        </p>

        <button
          type="button"
          onClick={choose}
          disabled={busy}
          className="mt-8 h-10 w-full rounded-lg bg-accent text-sm font-medium text-white transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? '正在准备…' : '选择数据目录'}
        </button>

        {error && <p className="mt-4 text-xs text-red-600">{error}</p>}

        <p className="mt-6 text-xs leading-5 text-muted/80">
          将创建 daily / weekly / projects / inbox 四个文件夹
        </p>
      </div>
    </div>
  )
}
