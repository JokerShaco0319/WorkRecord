import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { stripFrontmatter } from '@shared/md/section'
import type { WeeklyPreview } from '@shared/api'
import { addDaysKey, formatDateKey, formatMonthDay } from '@shared/date'
import { isoWeekKey, weekRangeFromKey } from '@shared/md/weekly'
import MarkdownPreview from './MarkdownPreview'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

const SourceEditor = lazy(() => import('./SourceEditor'))

/** 导出/复制时去掉 frontmatter 与自动区块标记 */
function reportText(raw: string): string {
  return stripFrontmatter(raw)
    .split('\n')
    .filter(
      (line) => !line.includes('<!-- auto:start -->') && !line.includes('<!-- auto:end -->')
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function WeeklyView({ initialWeek }: { initialWeek?: string }) {
  const [week, setWeek] = useState(
    () => initialWeek ?? isoWeekKey(formatDateKey(new Date()))
  )
  const [preview, setPreview] = useState<WeeklyPreview | null>(null)
  const [fileRaw, setFileRaw] = useState<string | null>(null)
  const [mode, setMode] = useState<'view' | 'source'>('view')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const range = weekRangeFromKey(week)
  const currentWeek = isoWeekKey(formatDateKey(new Date()))

  const load = useCallback(async (target: string) => {
    try {
      const [nextPreview, existing] = await Promise.all([
        window.api.weekly.preview(target),
        window.api.weekly.read(target)
      ])
      setPreview(nextPreview)
      setFileRaw(existing)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [])

  useEffect(() => {
    setMode('view')
    void load(week)
  }, [week, load])

  async function generate(): Promise<void> {
    if (busy) return
    setBusy(true)
    try {
      setFileRaw(await window.api.weekly.generate(week))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const refreshFile = useCallback(async () => {
    setFileRaw(await window.api.weekly.read(week))
    await load(week)
  }, [week, load])

  const content = fileRaw ?? preview?.body ?? ''

  async function copyReport(): Promise<void> {
    if (!content) return
    await window.api.clipboard.write(reportText(content))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  async function exportReport(): Promise<void> {
    if (!content) return
    try {
      await window.api.weekly.export(week, reportText(content))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-4 pb-4 pt-6 sm:px-6 sm:pb-4 sm:pt-8 lg:px-10 lg:pb-5 lg:pt-10">
        <div className="mx-auto w-full max-w-[820px]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted">
                Weekly
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <h1 className="text-[27px] font-semibold tracking-tight">
                  第 {range.weekNumber} 周
                </h1>
                <span className="text-sm text-muted">
                  {formatMonthDay(range.start)} ~ {formatMonthDay(range.end)}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 lg:shrink-0 lg:justify-end lg:pt-1">
              <button
                type="button"
                onClick={() => setWeek(isoWeekKey(addDaysKey(range.start, -7)))}
                className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
                aria-label="上一周"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setWeek(isoWeekKey(addDaysKey(range.start, 7)))}
                className="grid h-7 w-7 place-items-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
                aria-label="下一周"
              >
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>

              {week !== currentWeek && (
                <button
                  type="button"
                  onClick={() => setWeek(currentWeek)}
                  className="ml-1 text-[11px] text-accent transition-opacity hover:opacity-70"
                >
                  回到本周
                </button>
              )}

              <button
                type="button"
                data-action="weekly-copy"
                onClick={() => void copyReport()}
                disabled={!content}
                className="ml-2 h-7 rounded-md border border-line bg-surface px-2.5 text-[11px] text-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                {copied ? '已复制' : '复制'}
              </button>
              <button
                type="button"
                data-action="weekly-export"
                onClick={() => void exportReport()}
                disabled={!content}
                className="ml-1 h-7 rounded-md border border-line bg-surface px-2.5 text-[11px] text-muted transition-colors hover:text-ink disabled:opacity-50"
              >
                导出
              </button>

              {fileRaw && (
                <button
                  type="button"
                  data-action="weekly-toggle-mode"
                  onClick={() => setMode((current) => (current === 'view' ? 'source' : 'view'))}
                  className="ml-2 h-7 rounded-md border border-line bg-surface px-2.5 text-[11px] text-muted transition-colors hover:text-ink"
                >
                  {mode === 'view' ? '编辑' : '预览'}
                </button>
              )}

              <button
                type="button"
                data-action="weekly-generate"
                onClick={() => void generate()}
                disabled={busy}
                className="ml-1 h-7 rounded-md bg-accent px-2.5 text-[11px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {busy ? '生成中…' : fileRaw ? '重新生成' : '生成周报'}
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
            {preview && (
              <span>
                本周 {preview.entryCount} 条记录 · {preview.projectCount} 个项目
              </span>
            )}
            <span>·</span>
            <span>
              {fileRaw
                ? `已保存到 weekly/${week.slice(0, 4)}/${week}.md`
                : '尚未生成周报文件'}
            </span>
          </div>

          {error && (
            <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>

      {mode === 'source' && fileRaw ? (
        <div className="min-h-0 flex-1">
          <Suspense fallback={<div className="p-6 text-[12px] text-muted">正在加载编辑器…</div>}>
            <SourceEditor
              sourceKey={week}
              label={`weekly/${week.slice(0, 4)}/${week}.md`}
              load={async () => (await window.api.weekly.read(week)) ?? ''}
              save={async (raw) => {
                await window.api.weekly.save(week, raw)
              }}
              onSaved={() => void refreshFile()}
              onError={setError}
            />
          </Suspense>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 sm:px-6 sm:pb-12 lg:px-10 lg:pb-14">
          <div className="mx-auto w-full max-w-[820px]">
            {!fileRaw && (
              <div className="mb-3 rounded-lg border border-line bg-surface/60 px-3 py-2 text-[11px] leading-5 text-muted">
                这是根据本周记录自动汇总的草稿。生成后会写入{' '}
                <span className="font-mono">weekly/{week.slice(0, 4)}/{week}.md</span>，之后可以继续手写补充；重新生成只会覆盖自动区块。
              </div>
            )}

            <div className="rounded-xl border border-line bg-surface px-7 py-6">
              <MarkdownPreview raw={content} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
