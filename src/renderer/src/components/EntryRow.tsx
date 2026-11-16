import { useEffect, useRef, useState } from 'react'
import type { DailyEntry, EntryInput } from '@shared/md/month'
import { parseEntryLine } from '@shared/md/month'
import { CheckIcon, PencilIcon, TrashIcon } from './icons'

interface Props {
  entry: DailyEntry
  onSave: (entry: DailyEntry, next: EntryInput) => void
  onRemove: (entry: DailyEntry) => void
}

function toEditable(entry: DailyEntry): string {
  const parts: string[] = []
  if (entry.project) parts.push(`[[${entry.project}]]`)
  parts.push(entry.content)
  for (const tag of entry.tags) parts.push(`#${tag}`)
  return parts.join(' ')
}

export default function EntryRow({ entry, onSave, onRemove }: Props) {
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
    setDraft(toEditable(entry))
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

    const parsed = parseEntryLine(`- ${value}`, 0)
    onSave(entry, {
      time: entry.time,
      project: parsed?.project ?? null,
      content: parsed?.content ?? value,
      tags: parsed?.tags ?? [],
      done: entry.done
    })
  }

  function cancel(): void {
    skipCommit.current = true
    setEditing(false)
  }

  function toggleDone(): void {
    onSave(entry, {
      time: entry.time,
      project: entry.project,
      content: entry.content,
      tags: entry.tags,
      done: !entry.done
    })
  }

  function armConfirm(): void {
    setConfirming(true)
    if (confirmTimer.current) window.clearTimeout(confirmTimer.current)
    confirmTimer.current = window.setTimeout(() => setConfirming(false), 3000)
  }

  return (
    <li className="group flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface">
      <span className="mt-[4px] w-10 shrink-0 font-mono text-[11px] leading-5 tabular-nums text-muted">
        {entry.time ?? '—'}
      </span>

      <button
        type="button"
        onClick={toggleDone}
        aria-label={entry.done ? '标记为未完成' : '标记为完成'}
        className={`mt-[5px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border transition-colors ${
          entry.done ? 'border-accent bg-accent text-white' : 'border-line hover:border-accent'
        }`}
      >
        {entry.done && <CheckIcon className="h-2.5 w-2.5" />}
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
          placeholder="内容，可写 [[项目]] 与 #标签"
          className="min-w-0 flex-1 bg-transparent text-sm leading-6 outline-none placeholder:text-muted/60"
        />
      ) : (
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            {entry.project && (
              <span className="rounded-[4px] bg-accent-soft px-1.5 py-px text-[11px] font-medium text-accent">
                {entry.project}
              </span>
            )}
            <span
              className={`text-sm leading-6 ${
                entry.done ? 'text-muted line-through decoration-muted/50' : ''
              }`}
            >
              {entry.content}
            </span>
            {entry.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-line/50 px-2 py-px text-[11px] text-muted">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {!editing && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button
            type="button"
            title="编辑"
            data-action="entry-edit"
            onClick={startEdit}
            className="grid h-6 w-6 place-items-center rounded text-muted/70 transition-colors hover:bg-paper hover:text-ink"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>

          {confirming ? (
            <button
              type="button"
              data-action="entry-delete-confirm"
              onClick={() => onRemove(entry)}
              className="rounded px-1.5 py-0.5 text-[11px] text-red-600 transition-colors hover:bg-red-50"
            >
              确认删除
            </button>
          ) : (
            <button
              type="button"
              title="删除"
              data-action="entry-delete"
              onClick={armConfirm}
              className="grid h-6 w-6 place-items-center rounded text-muted/70 transition-colors hover:bg-red-50 hover:text-red-600"
            >
              <TrashIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </li>
  )
}
