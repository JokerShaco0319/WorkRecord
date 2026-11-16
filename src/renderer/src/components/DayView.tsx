import { useCallback, useEffect, useRef, useState } from 'react'
import type { DailyEntry, DayDoc, EntryInput } from '@shared/md/month'
import {
  addDaysKey,
  formatDateKey,
  formatTimeHm,
  monthKeyForDate,
  parseDateKey,
  weekdayCn
} from '@shared/date'
import CalendarPanel from './CalendarPanel'
import EntryRow from './EntryRow'
import SmartInput from './SmartInput'
import SourceEditor from './SourceEditor'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from './icons'

type Mode = 'list' | 'source'

export default function DayView({ initialDate }: { initialDate?: string }) {
  const todayKey = formatDateKey(new Date())

  const [selected, setSelected] = useState(initialDate ?? todayKey)
  const [mode, setMode] = useState<Mode>('list')
  const [doc, setDoc] = useState<DayDoc | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [suggestions, setSuggestions] = useState<{ projects: string[]; tags: string[] }>({
    projects: [],
    tags: []
  })

  const previousSelected = useRef(selected)
  const date = parseDateKey(selected)
  const month = monthKeyForDate(selected)

  const load = useCallback(async (target: string) => {
    try {
      setDoc(await window.api.daily.read(target))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    if (previousSelected.current !== selected) {
      previousSelected.current = selected
      setDoc(null)
    }
    void load(selected)
  }, [selected, refreshKey, load])

  useEffect(() => {
    return window.api.events.onDataChanged(() => {
      void load(selected)
    })
  }, [load, selected])

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
  }, [refreshKey])

  const submit = useCallback(async () => {
    const content = text.trim()
    if (!content || busy) return

    setBusy(true)
    setError(null)
    try {
      setDoc(await window.api.daily.appendEntry(selected, { time: formatTimeHm(new Date()), content }))
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [busy, selected, text])

  const saveEntry = useCallback(
    async (entry: DailyEntry, next: EntryInput) => {
      try {
        setDoc(
          await window.api.daily.updateEntry(
            selected,
            { line: entry.line, raw: entry.raw },
            next
          )
        )
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [selected]
  )

  const removeEntry = useCallback(
    async (entry: DailyEntry) => {
      try {
        setDoc(await window.api.daily.removeEntry(selected, { line: entry.line, raw: entry.raw }))
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    },
    [selected]
  )

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-10 pb-6 pt-10">
        <div className="mx-auto w-full max-w-[820px]">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
                {date.getFullYear()}
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <h1 className="text-[27px] font-semibold tracking-tight">
                  {date.getMonth() + 1} 月 {date.getDate()} 日
                </h1>
                <span className="text-sm text-muted">{weekdayCn(date)}</span>
                {selected !== todayKey && (
                  <button
                    type="button"
                    onClick={() => setSelected(todayKey)}
                    className="text-[11px] text-accent transition-opacity hover:opacity-70"
                  >
                    回到今天
                  </button>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1 pt-1">
              <button
                type="button"
                onClick={() => setSelected(addDaysKey(selected, -1))}
                className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
                aria-label="前一天"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSelected(addDaysKey(selected, 1))}
                className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
                aria-label="后一天"
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>

              <div className="relative ml-1">
                <button
                  type="button"
                  data-action="calendar"
                  onClick={() => setCalendarOpen((open) => !open)}
                  className="flex h-7 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-[11px] text-muted transition-colors hover:text-ink"
                >
                  <CalendarIcon className="h-3.5 w-3.5" />
                  日历
                </button>

                {calendarOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setCalendarOpen(false)} />
                    <CalendarPanel
                      value={selected}
                      className="absolute right-0 top-full z-40 mt-2"
                      onSelect={(next) => {
                        setSelected(next)
                        setCalendarOpen(false)
                      }}
                    />
                  </>
                )}
              </div>

              <div className="ml-2 flex rounded-lg border border-line bg-paper p-0.5">
                {(
                  [
                    ['list', '记录'],
                    ['source', '源码']
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    data-action={`tab-${key}`}
                    onClick={() => setMode(key)}
                    className={`rounded-[6px] px-2.5 py-1 text-[11px] transition-colors ${
                      mode === key
                        ? 'bg-surface font-medium text-ink shadow-[0_1px_2px_rgb(0_0_0_/_0.06)]'
                        : 'text-muted hover:text-ink'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      {mode === 'list' ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-10 pb-14">
          <div className="mx-auto w-full max-w-[820px]">
            <div className="flex rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgb(0_0_0_/_0.04)] transition focus-within:border-accent/50 focus-within:shadow-[0_0_0_3px_var(--color-accent-soft)]">
              <SmartInput
                value={text}
                onChange={setText}
                onSubmit={() => void submit()}
                placeholder="记录一条…  输入 @ 选项目、# 选标签"
                className="w-full bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted/70"
                projects={suggestions.projects}
                tags={suggestions.tags}
              />
            </div>
            <p className="mt-2 px-1 text-[11px] text-muted/70">按 Enter 保存，自动记下当前时间</p>

            {doc && doc.entries.length > 0 ? (
              <ol className="mt-6 space-y-0.5">
                {doc.entries.map((entry) => (
                  <EntryRow
                    key={`${entry.line}-${entry.raw}`}
                    entry={entry}
                    projects={suggestions.projects}
                    tags={suggestions.tags}
                    onSave={saveEntry}
                    onRemove={removeEntry}
                  />
                ))}
              </ol>
            ) : doc ? (
              <div className="mt-20 text-center">
                <p className="text-sm text-muted">
                  {selected === todayKey ? '今天还没有记录' : '这一天还没有记录'}
                </p>
                <p className="mt-1 text-xs text-muted/70">写下第一条，周末就能自动汇总</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <SourceEditor
            sourceKey={month}
            label={`daily/${month.slice(0, 4)}/${month}.md`}
            load={async () => (await window.api.daily.readMonth(month)).raw}
            save={async (raw) => {
              await window.api.daily.saveMonth(month, raw)
            }}
            onSaved={() => setRefreshKey((key) => key + 1)}
            onError={setError}
          />
        </div>
      )}
    </div>
  )
}
