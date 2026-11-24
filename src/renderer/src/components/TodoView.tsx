import { useCallback, useEffect, useState } from 'react'
import { formatDateKey } from '@shared/date'
import type { Quadrant, TodoDoc, TodoInput, TodoItem } from '@shared/md/todo'
import { QUADRANTS, parseTodoItem } from '@shared/md/todo'
import TodoArchive from './TodoArchive'
import TodoRow from './TodoRow'
import UndoToast from './UndoToast'

type QuadrantMeta = (typeof QUADRANTS)[number]

interface CardProps {
  quadrant: QuadrantMeta
  items: TodoItem[]
  today: string
  onAdd: (quadrant: Quadrant, input: TodoInput) => void
  onToggle: (item: TodoItem) => void
  onSave: (item: TodoItem, input: TodoInput) => void
  onRemove: (item: TodoItem) => void
  onDragStart: (item: TodoItem) => void
  onDragEnd: () => void
  onDropItem: (quadrant: Quadrant) => void
}

function QuadrantCard({
  quadrant,
  items,
  today,
  onAdd,
  onToggle,
  onSave,
  onRemove,
  onDragStart,
  onDragEnd,
  onDropItem
}: CardProps) {
  const [text, setText] = useState('')
  const [over, setOver] = useState(false)

  function submit(): void {
    const value = text.trim()
    if (!value) return
    const parsed = parseTodoItem(`- ${value}`, 0, quadrant.key)
    onAdd(
      quadrant.key,
      parsed
        ? { content: parsed.content, due: parsed.due, project: parsed.project }
        : { content: value }
    )
    setText('')
  }

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        setOver(true)
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget as Node | null
        if (!next || !event.currentTarget.contains(next)) setOver(false)
      }}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        onDropItem(quadrant.key)
      }}
      className={`flex min-h-[200px] flex-col rounded-xl border p-3 transition-colors sm:min-h-[240px] ${
        over ? 'border-accent bg-accent-soft/50' : 'border-line bg-surface'
      }`}
    >
      <header className="mb-2 flex items-baseline justify-between px-1">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13px] font-medium">{quadrant.title}</h2>
          <span className="text-[11px] text-muted/70">{quadrant.hint}</span>
        </div>
        <span className="text-[11px] tabular-nums text-muted/60">{items.length}</span>
      </header>

      <ul className="flex-1 space-y-0.5">
        {items.map((item) => (
          <TodoRow
            key={`${item.line}-${item.raw}`}
            item={item}
            today={today}
            onToggle={onToggle}
            onSave={onSave}
            onRemove={onRemove}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        ))}
        {items.length === 0 && (
          <li className="px-2 py-2 text-[12px] text-muted/50">暂无待办</li>
        )}
      </ul>

      <input
        data-todo-add={quadrant.key}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
          }
        }}
        placeholder="添加待办…"
        className="mt-2 w-full rounded-md border border-transparent bg-paper px-2 py-1.5 text-[12px] outline-none transition-colors placeholder:text-muted/60 focus:border-accent/40 focus:bg-surface"
      />
    </section>
  )
}

export default function TodoView() {
  const today = formatDateKey(new Date())

  const [doc, setDoc] = useState<TodoDoc | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'board' | 'archive'>('board')
  const [dragging, setDragging] = useState<TodoItem | null>(null)
  const [pendingDelete, setPendingDelete] = useState<TodoItem | null>(null)

  const load = useCallback(async () => {
    try {
      setDoc(await window.api.todo.read())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const run = useCallback(async (action: Promise<TodoDoc>) => {
    try {
      setDoc(await action)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  const target = (item: TodoItem): { line: number; raw: string } => ({
    line: item.line,
    raw: item.raw
  })

  const handleRemove = useCallback(async (item: TodoItem) => {
    try {
      setDoc(await window.api.todo.remove(target(item)))
      setPendingDelete(item)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  async function undoDelete(): Promise<void> {
    const item = pendingDelete
    if (!item) return

    setPendingDelete(null)
    try {
      setDoc(
        await window.api.todo.add(item.quadrant, {
          content: item.content,
          due: item.due,
          project: item.project
        })
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const dismissUndo = useCallback(() => setPendingDelete(null), [])

  const openCount = doc?.items.filter((item) => !item.done).length ?? 0

  if (mode === 'archive') {
    return (
      <TodoArchive
        onBack={() => {
          setMode('board')
          void load()
        }}
      />
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pb-4 pt-6 sm:px-6 sm:pb-5 sm:pt-8 lg:px-10 lg:pb-6 lg:pt-10">
        <div className="mx-auto w-full max-w-[980px]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
                Todo
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <h1 className="text-[27px] font-semibold tracking-tight">待办清单</h1>
                <span className="text-sm text-muted">{openCount} 项未完成</span>
              </div>
            </div>

            <button
              type="button"
              data-action="todo-archive"
              onClick={() => setMode('archive')}
              className="h-7 self-start rounded-md border border-line bg-surface px-2.5 text-[11px] text-muted transition-colors hover:text-ink"
            >
              归档
            </button>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-6 sm:pb-12 lg:px-10 lg:pb-14">
        <div className="mx-auto grid w-full max-w-[980px] grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
          {QUADRANTS.map((quadrant) => (
            <QuadrantCard
              key={quadrant.key}
              quadrant={quadrant}
              items={
                doc?.items.filter(
                  (item) => item.quadrant === quadrant.key && !item.done
                ) ?? []
              }
              today={today}
              onAdd={(key, input) => void run(window.api.todo.add(key, input))}
              onToggle={(item) => void run(window.api.todo.toggle(target(item)))}
              onSave={(item, input) => void run(window.api.todo.update(target(item), input))}
              onRemove={(item) => void handleRemove(item)}
              onDragStart={setDragging}
              onDragEnd={() => setDragging(null)}
              onDropItem={(key) => {
                if (dragging) void run(window.api.todo.move(target(dragging), key))
                setDragging(null)
              }}
            />
          ))}
        </div>
      </div>

      {pendingDelete && (
        <UndoToast
          message="已删除 1 条待办"
          onUndo={() => void undoDelete()}
          onDismiss={dismissUndo}
        />
      )}
    </div>
  )
}
