import { useCallback, useEffect, useState } from 'react'
import { formatDateKey } from '@shared/date'
import type { ArchiveItem } from '@shared/md/todoArchive'
import { QUADRANTS } from '@shared/md/todo'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

export default function TodoArchive({ onBack }: { onBack: () => void }) {
  const [month, setMonth] = useState(() => formatDateKey(new Date()).slice(0, 7))
  const [items, setItems] = useState<ArchiveItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)

  const load = useCallback(async (target: string) => {
    try {
      setItems(await window.api.todo.archive(target))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void load(month)
  }, [month, load])

  function shiftMonth(delta: number): void {
    const [year, monthNumber] = month.split('-').map(Number)
    const date = new Date(year, monthNumber - 1 + delta, 1)
    setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }

  async function restore(item: ArchiveItem): Promise<void> {
    setRestoring(item.raw)
    try {
      setItems(await window.api.todo.restore(month, { line: item.line, raw: item.raw }))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRestoring(null)
    }
  }

  const [year, monthNumber] = month.split('-').map(Number)

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-10 pb-5 pt-10">
        <div className="mx-auto w-full max-w-[980px]">
          <button
            type="button"
            data-action="archive-back"
            onClick={onBack}
            className="flex items-center gap-1 text-[11px] text-muted transition-colors hover:text-ink"
          >
            <ChevronLeftIcon className="h-3 w-3" />
            返回待办
          </button>

          <div className="mt-2 flex items-end justify-between gap-6">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
                Archive
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <h1 className="text-[27px] font-semibold tracking-tight">
                  {year} 年 {monthNumber} 月
                </h1>
                <span className="text-sm text-muted">{items?.length ?? 0} 项已完成</span>
              </div>
            </div>

            <div className="flex items-center gap-1 pb-1">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
                aria-label="上个月"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
                aria-label="下个月"
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-10 pb-14">
        <div className="mx-auto w-full max-w-[980px]">
          {items && items.length > 0 ? (
            <ul className="space-y-0.5">
              {items.map((item) => (
                <li
                  key={`${item.line}-${item.raw}`}
                  className="flex items-start gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-surface"
                >
                  <span className="mt-[3px] w-10 shrink-0 font-mono text-[11px] tabular-nums text-muted/70">
                    {item.doneDate ? item.doneDate.slice(5) : '—'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="text-[13px] leading-5 text-muted line-through decoration-muted/40">
                        {item.content}
                      </span>
                      {item.project && (
                        <span className="rounded-[4px] bg-accent-soft px-1.5 py-px text-[10px] text-accent">
                          {item.project}
                        </span>
                      )}
                      <span className="text-[10px] text-muted/60">
                        {QUADRANTS.find((q) => q.key === item.quadrant)?.title ?? ''}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    data-action="archive-restore"
                    disabled={restoring === item.raw}
                    onClick={() => void restore(item)}
                    className="shrink-0 text-[11px] text-accent transition-opacity hover:opacity-70 disabled:opacity-40"
                  >
                    恢复
                  </button>
                </li>
              ))}
            </ul>
          ) : items ? (
            <div className="mt-16 text-center">
              <p className="text-sm text-muted">这个月还没有完成的事项</p>
              <p className="mt-1 text-xs text-muted/70">完成待办后会自动归档到完成月份</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
