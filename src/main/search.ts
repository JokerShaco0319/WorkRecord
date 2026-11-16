import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { SearchHit } from '@shared/api'
import { parseMonth } from '@shared/md/month'
import { parseTodo } from '@shared/md/todo'

interface WalkedFile {
  abs: string
  rel: string
}

const KIND_ORDER: Record<SearchHit['kind'], number> = {
  entry: 0,
  todo: 1,
  weekly: 2,
  'project-file': 3
}

export async function listMarkdown(root: string): Promise<WalkedFile[]> {
  const files: WalkedFile[] = []

  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), rel)
      } else if (entry.name.toLowerCase().endsWith('.md')) {
        files.push({ abs: join(dir, entry.name), rel })
      }
    }
  }

  await walk(root, '')
  return files
}

export async function searchVault(
  vaultPath: string,
  query: string,
  limit = 60
): Promise<SearchHit[]> {
  const needle = query.trim().toLowerCase()
  if (!needle) return []

  const hits: SearchHit[] = []

  for (const file of await listMarkdown(join(vaultPath, 'daily'))) {
    const month = basename(file.rel, '.md')
    if (!/^\d{4}-\d{2}$/.test(month)) continue

    const raw = await readFile(file.abs, 'utf-8').catch(() => '')
    for (const week of parseMonth(month, raw).weeks) {
      for (const day of week.days) {
        for (const entry of day.entries) {
          const haystack = `${entry.content} ${entry.project ?? ''} ${entry.tags.join(' ')}`
          if (!haystack.toLowerCase().includes(needle)) continue
          hits.push({
            kind: 'entry',
            date: day.date,
            time: entry.time,
            project: entry.project,
            content: entry.content
          })
        }
      }
    }
  }

  const todoRaw = await readFile(join(vaultPath, 'todo.md'), 'utf-8').catch(() => '')
  if (todoRaw) {
    for (const item of parseTodo(todoRaw).items) {
      if (!item.content.toLowerCase().includes(needle)) continue
      hits.push({
        kind: 'todo',
        quadrant: item.quadrant,
        content: item.content,
        done: item.done
      })
    }
  }

  for (const file of await listMarkdown(join(vaultPath, 'weekly'))) {
    const week = basename(file.rel, '.md')
    if (!/^\d{4}-W\d{2}$/.test(week)) continue

    const raw = await readFile(file.abs, 'utf-8').catch(() => '')
    for (const line of raw.split('\n')) {
      const text = line.replace(/^#{1,6}\s*/, '').trim()
      if (!text || text.startsWith('---') || /^(week|range):/.test(text)) continue
      if (!text.toLowerCase().includes(needle)) continue
      hits.push({ kind: 'weekly', week, text })
    }
  }

  for (const file of await listMarkdown(join(vaultPath, 'projects'))) {
    const parts = file.rel.split('/')
    if (parts.length < 3) continue
    const name = parts[parts.length - 1]
    if (!name.toLowerCase().includes(needle)) continue
    hits.push({ kind: 'project-file', project: parts[0], category: parts[1], name })
  }

  hits.sort((a, b) => {
    const diff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    if (diff !== 0) return diff
    if (a.kind === 'entry' && b.kind === 'entry') return b.date.localeCompare(a.date)
    return 0
  })

  return hits.slice(0, limit)
}

/** 统计所有日报条目里出现过的标签，按使用频率排序 */
export async function listTags(vaultPath: string): Promise<string[]> {
  const counts = new Map<string, number>()

  for (const file of await listMarkdown(join(vaultPath, 'daily'))) {
    const month = basename(file.rel, '.md')
    if (!/^\d{4}-\d{2}$/.test(month)) continue

    const raw = await readFile(file.abs, 'utf-8').catch(() => '')
    for (const week of parseMonth(month, raw).weeks) {
      for (const day of week.days) {
        for (const entry of day.entries) {
          for (const tag of entry.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
        }
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag)
}
