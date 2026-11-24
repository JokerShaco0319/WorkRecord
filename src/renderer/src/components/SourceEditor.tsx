import { useCallback, useEffect, useRef, useState } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { basicSetup } from 'codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { DEFAULT_UI_LAYOUT, UI_LAYOUT_LIMITS } from '@shared/layout'
import { useUiLayout } from './LayoutProvider'
import MarkdownPreview from './MarkdownPreview'
import ResizeHandle from './ResizeHandle'

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '12.5px',
    color: 'var(--color-ink)',
    backgroundColor: 'var(--color-paper)'
  },
  '.cm-scroller': {
    fontFamily: "'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
    lineHeight: '1.7',
    overflow: 'auto'
  },
  '.cm-content': {
    padding: '12px 0 48px',
    caretColor: 'var(--color-accent)'
  },
  '.cm-line': {
    padding: '0 18px'
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-muted)'
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--color-accent) 8%, transparent)'
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent'
  },
  '&.cm-focused': {
    outline: 'none'
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'var(--color-accent-soft)'
  },
  '.cm-cursor': {
    borderLeftColor: 'var(--color-accent)'
  }
})

interface Props {
  /** 变化时重新加载文档 */
  sourceKey: string
  label: string
  load: () => Promise<string>
  save: (raw: string) => Promise<void>
  onSaved: () => void
  onError: (message: string) => void
}

export default function SourceEditor({
  sourceKey,
  label,
  load,
  save,
  onSaved,
  onError
}: Props) {
  const { layout, preview, commit } = useUiLayout()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const savingRef = useRef(false)
  const loadRef = useRef(load)
  const saveRef = useRef(save)
  const onSavedRef = useRef(onSaved)
  const onErrorRef = useRef(onError)

  const [raw, setRaw] = useState('')
  const [saved, setSaved] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  loadRef.current = load
  saveRef.current = save
  onSavedRef.current = onSaved
  onErrorRef.current = onError

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    loadRef
      .current()
      .then((content) => {
        if (cancelled || !hostRef.current) return
        setRaw(content)
        setSaved(content)
        setLoading(false)

        if (!viewRef.current) {
          viewRef.current = new EditorView({
            parent: hostRef.current,
            state: EditorState.create({
              doc: content,
              extensions: [
                basicSetup,
                markdown(),
                EditorView.lineWrapping,
                editorTheme,
                EditorView.updateListener.of((update) => {
                  if (update.docChanged) setRaw(update.state.doc.toString())
                })
              ]
            })
          })
        } else {
          viewRef.current.dispatch({
            changes: { from: 0, to: viewRef.current.state.doc.length, insert: content }
          })
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setLoading(false)
        onErrorRef.current(err instanceof Error ? err.message : String(err))
      })

    return () => {
      cancelled = true
    }
  }, [sourceKey])

  useEffect(() => {
    return () => {
      viewRef.current?.destroy()
      viewRef.current = null
    }
  }, [])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const observer = new ResizeObserver(() => {
      viewRef.current?.requestMeasure()
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  const persist = useCallback(async () => {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    try {
      const next = viewRef.current ? viewRef.current.state.doc.toString() : raw
      await saveRef.current(next)
      setRaw(next)
      setSaved(next)
      onSavedRef.current()
    } catch (err) {
      onErrorRef.current(err instanceof Error ? err.message : String(err))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }, [raw])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        void persist()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [persist])

  const dirty = raw !== saved

  return (
    <div ref={containerRef} className="flex h-full min-h-0">
      <div
        className="flex min-w-0 flex-col"
        style={{ flexGrow: layout.sourceSplit, flexBasis: 0 }}
      >
        <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-line/70 px-4">
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">{label}</span>
          <div className="flex shrink-0 items-center gap-3">
            <span className={`text-[11px] ${dirty ? 'text-amber-600' : 'text-muted/60'}`}>
              {dirty ? '有未保存的修改' : '已保存'}
            </span>
            <button
              type="button"
              data-action="source-save"
              onClick={() => void persist()}
              disabled={!dirty || saving}
              className="rounded-md bg-accent px-2.5 py-1 text-[11px] font-medium text-white transition hover:brightness-110 disabled:bg-line disabled:text-muted"
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div ref={hostRef} className="h-full" />
          {loading && (
            <div className="absolute inset-0 grid place-items-center bg-paper/70 text-xs text-muted">
              正在读取…
            </div>
          )}
        </div>
      </div>

      <ResizeHandle
        unit="percent"
        value={layout.sourceSplit}
        min={UI_LAYOUT_LIMITS.sourceSplit.min}
        max={UI_LAYOUT_LIMITS.sourceSplit.max}
        defaultValue={DEFAULT_UI_LAYOUT.sourceSplit}
        step={2}
        containerRef={containerRef}
        ariaLabel="调整编辑与预览比例"
        onPreview={(sourceSplit) => preview({ sourceSplit })}
        onCommit={(sourceSplit) => {
          commit({ sourceSplit })
          viewRef.current?.requestMeasure()
        }}
      />

      <div
        className="min-w-0 overflow-y-auto bg-surface"
        style={{ flexGrow: 100 - layout.sourceSplit, flexBasis: 0 }}
      >
        <div className="px-4 py-4 lg:px-7 lg:py-6">
          <MarkdownPreview raw={raw} />
        </div>
      </div>
    </div>
  )
}
