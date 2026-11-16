import { useEffect, useMemo, useRef, useState } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  onCancel?: () => void
  onBlur?: () => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
  projects: string[]
  tags: string[]
  onPopupChange?: (open: boolean) => void
}

interface Suggestion {
  kind: 'project' | 'tag'
  query: string
  start: number
  end: number
}

function detect(value: string, caret: number): Suggestion | null {
  const before = value.slice(0, caret)

  const project = /\[\[([^[\]]*)$/.exec(before)
  if (project) {
    return {
      kind: 'project',
      query: project[1],
      start: caret - project[0].length,
      end: caret
    }
  }

  const mention = /(^|\s)@([^\s@]*)$/.exec(before)
  if (mention) {
    const text = mention[2]
    return { kind: 'project', query: text, start: caret - text.length - 1, end: caret }
  }

  const tag = /(^|\s)#([^\s#]*)$/.exec(before)
  if (tag) {
    const text = tag[2]
    return { kind: 'tag', query: text, start: caret - text.length - 1, end: caret }
  }

  return null
}

export default function SmartInput({
  value,
  onChange,
  onSubmit,
  onCancel,
  onBlur,
  placeholder,
  className,
  autoFocus,
  projects,
  tags,
  onPopupChange
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null)
  const [active, setActive] = useState(0)
  const onPopupChangeRef = useRef(onPopupChange)
  onPopupChangeRef.current = onPopupChange

  const items = useMemo(() => {
    if (!suggestion) return []
    const needle = suggestion.query.toLowerCase()
    const pool = suggestion.kind === 'project' ? projects : tags
    return pool.filter((item) => item.toLowerCase().includes(needle)).slice(0, 8)
  }, [suggestion, projects, tags])

  function sync(nextValue: string, caret: number): void {
    const next = detect(nextValue, caret)
    setSuggestion(next)
    setActive(0)
  }

  function accept(item: string): void {
    if (!suggestion) return

    const token = suggestion.kind === 'project' ? `[[${item}]]` : `#${item}`
    const next = value.slice(0, suggestion.start) + token + value.slice(suggestion.end)
    onChange(next)
    setSuggestion(null)

    const caret = suggestion.start + token.length
    requestAnimationFrame(() => {
      const element = inputRef.current
      if (!element) return
      element.focus()
      element.setSelectionRange(caret, caret)
    })
  }

  const open = suggestion !== null && items.length > 0

  useEffect(() => {
    onPopupChangeRef.current?.(open)
  }, [open])

  return (
    <div className="relative min-w-0 flex-1">
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={value}
        onChange={(event) => {
          const next = event.target.value
          onChange(next)
          sync(next, event.target.selectionStart ?? next.length)
        }}
        onClick={(event) => {
          const element = event.currentTarget
          sync(element.value, element.selectionStart ?? element.value.length)
        }}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (open) {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setActive((current) => (current + 1) % items.length)
              return
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setActive((current) => (current - 1 + items.length) % items.length)
              return
            }
            if (event.key === 'Tab' || (event.key === 'Enter' && !event.nativeEvent.isComposing)) {
              event.preventDefault()
              accept(items[Math.min(active, items.length - 1)])
              return
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setSuggestion(null)
              return
            }
          }

          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            onSubmit()
          }
          if (event.key === 'Escape' && onCancel) {
            event.preventDefault()
            onCancel()
          }
        }}
        placeholder={placeholder}
        className={className}
        data-action="smart-input"
      />

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-full max-w-[320px] overflow-hidden rounded-lg border border-line bg-surface shadow-[0_8px_24px_rgb(0_0_0_/_0.12)]">
          <div className="border-b border-line/60 px-3 py-1 text-[10px] uppercase tracking-[0.12em] text-muted/60">
            {suggestion.kind === 'project' ? '项目' : '标签'}
          </div>
          <ul className="max-h-[180px] overflow-y-auto py-1">
            {items.map((item, index) => (
              <li key={item}>
                <button
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault()
                    accept(item)
                  }}
                  onMouseEnter={() => setActive(index)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] transition-colors ${
                    index === active ? 'bg-paper' : ''
                  }`}
                >
                  <span className="text-muted/60">
                    {suggestion.kind === 'project' ? '@' : '#'}
                  </span>
                  <span className="truncate">{item}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-line/60 px-3 py-1 text-[10px] text-muted/50">
            Tab / Enter 选中 · ↑↓ 切换
          </div>
        </div>
      )}
    </div>
  )
}
