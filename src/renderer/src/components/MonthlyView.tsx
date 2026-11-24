import { useCallback, useEffect, useState } from 'react'
import { addMonthsToMonthKey, formatDateKey } from '@shared/date'
import { parseMonth } from '@shared/md/month'
import {
  buildMonthlyReport,
  collectMonthEntries,
  type MonthReportEntry
} from '@shared/md/report'
import MarkdownPreview from './MarkdownPreview'
import ExportDialog from './ExportDialog'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

function monthTitle(month: string): string {
  const [year, monthNumber] = month.split('-')
  return `${year} 年 ${Number(monthNumber)} 月`
}

export default function MonthlyView({ initialMonth }: { initialMonth?: string }) {
  const currentMonth = formatDateKey(new Date()).slice(0, 7)
  const [month, setMonth] = useState(initialMonth ?? currentMonth)
  const [entries, setEntries] = useState<MonthReportEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [exportText, setExportText] = useState<string | null>(null)

  const load = useCallback(async (target: string) => {
    try {
      // 跨月的一周归入周一所在的月份，当月前几天的记录可能在上个月的文件里
      const files = await Promise.all([
        window.api.daily.readMonth(addMonthsToMonthKey(target, -1)),
        window.api.daily.readMonth(target)
      ])
      const docs = files.map((file) => parseMonth(file.month, file.raw))
      setEntries(collectMonthEntries(docs, target))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    void load(month)
  }, [month, load])

  const content = buildMonthlyReport(month, entries)
  const projectCount = new Set(entries.map((entry) => entry.project ?? '其他')).size

  function openExport(): void {
    if (entries.length === 0) return
    setExportText(content)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pb-4 pt-6 sm:px-6 sm:pb-4 sm:pt-8 lg:px-10 lg:pb-5 lg:pt-10">
        <div className="mx-auto w-full max-w-[820px]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
                Monthly
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <h1 className="text-[27px] font-semibold tracking-tight">{monthTitle(month)}</h1>
                {month !== currentMonth && (
                  <button
                    type="button"
                    onClick={() => setMonth(currentMonth)}
                    className="text-[11px] text-accent transition-opacity hover:opacity-70"
                  >
                    回到本月
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 lg:shrink-0 lg:justify-end lg:pt-1">
              <button
                type="button"
                onClick={() => setMonth(addMonthsToMonthKey(month, -1))}
                className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
                aria-label="上个月"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setMonth(addMonthsToMonthKey(month, 1))}
                className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
                aria-label="下个月"
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>

              <button
                type="button"
                data-action="monthly-export"
                onClick={openExport}
                disabled={entries.length === 0}
                className="ml-2 h-7 rounded-md border border-line bg-surface px-2.5 text-[11px] text-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                导出
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
            <span>
              本月 {entries.length} 条记录 · {projectCount} 个项目
            </span>
            <span>·</span>
            <span>按项目分类</span>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-6 sm:pb-12 lg:px-10 lg:pb-14">
        <div className="mx-auto w-full max-w-[820px]">
          <div className="rounded-xl border border-line bg-surface px-7 py-6">
            <MarkdownPreview raw={content} />
          </div>
        </div>
      </div>

      {exportText !== null && (
        <ExportDialog
          title="导出月报"
          initialText={exportText}
          onClose={() => setExportText(null)}
        />
      )}
    </div>
  )
}
