import { useEffect, useRef, useState, type CSSProperties } from 'react'

const dragRegion = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragRegion = { WebkitAppRegion: 'no-drag' } as CSSProperties

export default function CaptureView() {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function submit(): Promise<void> {
    const value = text.trim()
    if (!value || busy) return
    setBusy(true)
    try {
      await window.api.capture.submit(value)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      style={dragRegion}
      className="flex h-full flex-col justify-center gap-2 border border-line/60 bg-surface px-5"
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-wide text-muted">快速记录</span>
        <button
          type="button"
          onClick={() => void window.api.capture.close()}
          style={noDragRegion}
          className="rounded px-1.5 py-0.5 text-[10px] text-muted/70 transition-colors hover:bg-paper hover:text-ink"
        >
          Esc
        </button>
      </div>

      <input
        ref={inputRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            void submit()
          }
          if (event.key === 'Escape') {
            event.preventDefault()
            void window.api.capture.close()
          }
        }}
        placeholder="记一条…  可写 #标签 或 [[项目]]"
        style={noDragRegion}
        className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none placeholder:text-muted/60 focus:border-accent/50"
      />

      <p className="text-[10px] text-muted/70">Enter 保存到今天的记录 · Esc 关闭</p>
    </div>
  )
}
