import { useEffect, useState } from 'react'
import type { SearchHit } from '@shared/api'
import { QUADRANTS } from '@shared/md/todo'
import { SearchIcon } from './icons'

interface Props {
  onClose: () => void
  onOpen: (hit: SearchHit) => void
}

function describe(hit: SearchHit): { title: string; meta: string } {
  switch (hit.kind) {
    case 'entry':
      return {
        title: hit.content,
        meta: [hit.date, hit.project].filter(Boolean).join(' · ')
      }
    case 'todo':
      return {
        title: hit.content,
        meta: QUADRANTS.find((item) => item.key === hit.quadrant)?.title ?? '待办'
      }
    case 'weekly':
      return { title: hit.text, meta: `周报 ${hit.week}` }
    case 'project-file':
      return {
        title: hit.name,
        meta:
          hit.match === 'content'
            ? `内容匹配 · ${hit.project} / ${hit.category}`
            : `${hit.project} / ${hit.category}`
      }
  }
}

export default function SearchOverlay({ onClose, onOpen }: Props) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [active, setActive] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const text = query.trim()
    if (!text) {
      setHits([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    const timer = window.setTimeout(() => {
      window.api.search
        .query(text, 60)
        .then((next) => {
          if (cancelled) return
          setHits(next)
          setActive(0)
        })
        .catch(() => {
          if (!cancelled) setHits([])
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query])

  useEffect(() => {
    if (active >= hits.length) setActive(0)
  }, [hits, active])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/25 px-4 pt-[8vh] sm:pt-[12vh]"
      onMouseDown={onClose}
      data-action="search-overlay"
    >
      <div
        className="mx-auto w-full max-w-[560px] overflow-hidden rounded-xl border border-line bg-surface shadow-[0_16px_48px_rgb(0_0_0_/_0.18)]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4">
          <SearchIcon className="h-4 w-4 shrink-0 text-muted/70" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                setActive((current) => Math.min(current + 1, Math.max(hits.length - 1, 0)))
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                setActive((current) => Math.max(current - 1, 0))
              }
              if (event.key === 'Enter' && hits[active]) {
                event.preventDefault()
                onOpen(hits[active])
              }
            }}
            placeholder="搜索记录、待办、周报与项目文件…"
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted/60"
          />
        </div>

        <ul className="max-h-[52vh] overflow-y-auto py-1">
          {hits.map((hit, index) => {
            const { title, meta } = describe(hit)
            return (
              <li key={`${hit.kind}-${index}`}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onClick={() => onOpen(hit)}
                  className={`flex w-full items-start gap-3 px-4 py-2 text-left transition-colors ${
                    index === active ? 'bg-paper' : ''
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px]">{title}</span>
                    {hit.kind === 'project-file' && hit.snippet && (
                      <span className="mt-0.5 block truncate text-[11px] text-muted/70">
                        {hit.snippet}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 pt-px text-[11px] text-muted/70">{meta}</span>
                </button>
              </li>
            )
          })}

          {loading && hits.length === 0 && (
            <li className="px-4 py-6 text-center text-[12px] text-muted/70">正在搜索…</li>
          )}
          {!loading && query.trim() && hits.length === 0 && (
            <li className="px-4 py-6 text-center text-[12px] text-muted/70">没有找到匹配内容</li>
          )}
          {!query.trim() && (
            <li className="px-4 py-6 text-center text-[12px] text-muted/60">
              输入关键词，搜索日报条目、待办、周报和项目文件
            </li>
          )}
        </ul>

        <div className="border-t border-line px-4 py-2 text-[10px] text-muted/60">
          ↑↓ 选择 · Enter 打开 · Esc 关闭
        </div>
      </div>
    </div>
  )
}
