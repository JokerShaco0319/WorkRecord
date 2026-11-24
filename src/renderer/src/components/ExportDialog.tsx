import { useEffect, useRef, useState } from 'react'

interface Props {
  title: string
  initialText: string
  onClose: () => void
}

export default function ExportDialog({ title, initialText, onClose }: Props) {
  const [text, setText] = useState(initialText)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | null>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    areaRef.current?.focus()
    areaRef.current?.setSelectionRange(0, 0)
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current)
    }
  }, [])

  async function copy(): Promise<void> {
    await window.api.clipboard.write(text)
    setCopied(true)
    if (copyTimer.current) window.clearTimeout(copyTimer.current)
    copyTimer.current = window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className="fixed inset-0 z-[60] grid place-items-center bg-black/30 p-6"
      data-action="export-dialog"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_24px_64px_rgb(0_0_0_/_0.24)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-line px-6 pb-4 pt-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
            Export
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <h2 className="text-[19px] font-semibold tracking-tight">{title}</h2>
            <span className="text-[11px] tabular-nums text-muted">{text.length} 字</span>
          </div>
          <p className="mt-1.5 text-[11px] text-muted">
            内容可以直接修改，修改只用于本次复制，不会写入原始记录。
          </p>
        </div>

        <textarea
          ref={areaRef}
          aria-label={title}
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          className="min-h-[300px] flex-1 resize-none bg-surface px-6 py-4 font-mono text-[12.5px] leading-6 text-ink outline-none"
        />

        <div className="flex items-center justify-end gap-2 border-t border-line px-6 py-3">
          <button
            type="button"
            data-action="export-close"
            onClick={onClose}
            className="h-8 rounded-md border border-line bg-paper px-3 text-[11px] text-muted transition-colors hover:text-ink"
          >
            关闭
          </button>
          <button
            type="button"
            data-action="export-copy"
            onClick={() => void copy()}
            className="h-8 rounded-md bg-accent px-3 text-[11px] font-medium text-white transition hover:brightness-110"
          >
            {copied ? '已复制' : '复制'}
          </button>
        </div>
      </div>
    </div>
  )
}
