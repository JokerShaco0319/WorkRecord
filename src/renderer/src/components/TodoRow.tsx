import { useEffect, useRef, useState } from 'react'
import type { TodoInput, TodoItem } from '@shared/md/todo'
import { parseTodoItem } from '@shared/md/todo'
import { CheckIcon, PencilIcon, TrashIcon } from './icons'

interface Props {
  item: TodoItem
  today: string
  onToggle: (item: TodoItem) => void
  onSave: (item: TodoItem, input: TodoInput) => void
  onRemove: (item: TodoItem) => void
  onDragStart: (item: TodoItem) => void
  onDragEnd: () => void
}

function editableValue(item: TodoItem): string {
  const parts = [item.content]
  if (item.due) parts.push(`due:${item.due}`)
  if (item.project) parts.push(`proj:${item.project}`)
  return parts.join(' | ')
}

export default function TodoRow({
  item,
  today,
  onToggle,
  onSave,
  onRemove,
  onDragStart,
  onDragEnd
}: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [confirming, setConfirming] = useState(false)
  const skipCommit = useRef(false)
  const confirmTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
    }
  }, [])

  function startEdit(): void {
    skipCommit.current = false
    setDraft(editableValue(item))
    setEditing(true)
  }

  function commit(): void {
    if (skipCommit.current) {
      skipCommit.current = false
      return
    }
    const value = draft.trim()
    setEditing(false)
    if (!value) return

    const parsed = parseTodoItem(`- ${value}`, 0, item.quadrant)
    onSave(item, {
      content: parsed?.content ?? value,
      due: parsed?.due ?? null,
      project: parsed?.project ?? null
    })
  }

  function cancel(): void {
    skipCommit.current = true
    setEditing(false)
  }

  function armConfirm(): void {
    setConfirming(true)
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
    confirmTimer.current = window.setTimeout(() => setConfirming(false), 3000)
  }

  const overdue = Boolean(item.due && !item.done && item.due < today)

  return (
    <li
      draggable={!editing}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(item.line))
        onDragStart(item)
      }}
      onDragEnd={onDragEnd}
      className="group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-paper"
    >
      <button
        type="button"
        data-action="todo-toggle"
        onClick={() => onToggle(item)}
        aria-label={item.done ? '标记为未完成' : '标记为完成'}
        className={`mt-[4px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border transition-colors ${
          item.done ? 'border-accent bg-accent text-white' : 'border-line hover:border-accent'
        }`}
      >
        {item.done && <CheckIcon className="h-2.5 w-2.5" />}
      </button>

      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
              event.preventDefault()
              commit()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              cancel()
            }
          }}
          placeholder="内容 | due:2026-11-18 | proj:项目A"
          className="min-w-0 flex-1 bg-transparent text-[13px] leading-5 outline-none placeholder:text-muted/60"
        />
      ) : (
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
            <span
              className={`text-[13px] leading-5 ${
                item.done ? 'text-muted line-through decoration-muted/50' : ''
              }`}
            >
              {item.content}
            </span>
            {item.due && (
              <span
                className={`rounded px-1 py-px text-[10px] leading-4 ${
                  overdue ? 'bg-red-50 font-medium text-red-600' : 'bg-paper text-muted'
                }`}
              >
                {overdue ? `${item.due.slice(5)} 逾期` : item.due.slice(5)}
              </span>
            )}
            {item.project && (
              <span className="rounded-[3px] bg-accent-soft px-1 py-px text-[10px] leading-4 text-accent">
                {item.project}
              </span>
            )}
          </div>
        </div>
      )}

      {!editing && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            title="编辑"
            data-action="todo-edit"
            onClick={startEdit}
            className="grid h-5 w-5 place-items-center rounded text-muted/70 transition-colors hover:bg-surface hover:text-ink"
          >
            <PencilIcon className="h-3 w-3" />
          </button>

          {confirming ? (
            <button
              type="button"
              data-action="todo-delete-confirm"
              onClick={() => onRemove(item)}
              className="rounded px-1 py-0.5 text-[10px] text-red-600 transition-colors hover:bg-red-50"
            >
              确认
            </button>
          ) : (
            <button
              type="button"
              title="删除"
              data-action="todo-delete"
              onClick={armConfirm}
              className="grid h-5 w-5 place-items-center rounded text-muted/70 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </li>
  )
}
