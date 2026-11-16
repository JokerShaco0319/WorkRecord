import { useEffect, useState, type CSSProperties } from 'react'
import SmartInput from './SmartInput'

const dragRegion = { WebkitAppRegion: 'drag' } as CSSProperties
const noDragRegion = { WebkitAppRegion: 'no-drag' } as CSSProperties

export default function CaptureView() {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [suggestions, setSuggestions] = useState<{ projects: string[]; tags: string[] }>({
    projects: [],
    tags: []
  })

  useEffect(() => {
    let cancelled = false

    Promise.all([window.api.projects.list(), window.api.daily.tags()])
      .then(([projects, tags]) => {
        if (!cancelled) setSuggestions({ projects: projects.map((item) => item.name), tags })
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
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

  function handlePopupChange(open: boolean): void {
    void window.api.capture.resize(open ? 320 : 148)
  }

  return (
    <div
      style={dragRegion}
      className="flex h-full flex-col justify-start gap-2 border border-line/60 bg-surface px-5 pt-4"
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

      <div style={noDragRegion}>
        <SmartInput
          autoFocus
          value={text}
          onChange={setText}
          onSubmit={() => void submit()}
          onCancel={() => void window.api.capture.close()}
          placeholder="记一条…  输入 @ 选项目、# 选标签"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none placeholder:text-muted/60 focus:border-accent/50"
          projects={suggestions.projects}
          tags={suggestions.tags}
          onPopupChange={handlePopupChange}
        />
      </div>

      <p className="text-[10px] text-muted/70">Enter 保存到今天的记录 · Esc 关闭</p>
    </div>
  )
}
