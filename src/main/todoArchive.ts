import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { ArchiveInput, ArchiveItem, ArchiveTarget } from '@shared/md/todoArchive'
import {
  appendArchiveItems,
  archiveTemplate,
  parseArchive,
  removeArchiveItem
} from '@shared/md/todoArchive'
import { parseTodo } from '@shared/md/todo'

export function archivePath(vaultPath: string, month: string): string {
  return join(vaultPath, 'todo-archive', `${month}.md`)
}

export async function readArchiveRaw(vaultPath: string, month: string): Promise<string> {
  try {
    return await readFile(archivePath(vaultPath, month), 'utf-8')
  } catch {
    return archiveTemplate(month)
  }
}

export async function listArchive(vaultPath: string, month: string): Promise<ArchiveItem[]> {
  return parseArchive(await readArchiveRaw(vaultPath, month))
}

export async function appendCompleted(
  vaultPath: string,
  month: string,
  items: ArchiveInput[]
): Promise<void> {
  if (items.length === 0) return

  const raw = await readArchiveRaw(vaultPath, month)
  const file = archivePath(vaultPath, month)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, appendArchiveItems(raw, items), 'utf-8')
}

export async function removeArchived(
  vaultPath: string,
  month: string,
  target: ArchiveTarget
): Promise<ArchiveItem[]> {
  const raw = await readArchiveRaw(vaultPath, month)
  const next = removeArchiveItem(raw, target)
  await writeFile(archivePath(vaultPath, month), next, 'utf-8')
  return parseArchive(next)
}

/** 把历史版本里写在 todo.md 中的已完成条目迁移到按月归档文件 */
export async function migrateCompletedTodos(vaultPath: string, today: string): Promise<void> {
  const todoPath = join(vaultPath, 'todo.md')

  let raw: string
  try {
    raw = await readFile(todoPath, 'utf-8')
  } catch {
    return
  }

  const done = parseTodo(raw).items.filter((item) => item.done)
  if (done.length === 0) return

  const groups = new Map<string, ArchiveInput[]>()
  for (const item of done) {
    const month = (item.doneDate ?? today).slice(0, 7)
    const list = groups.get(month) ?? []
    list.push({
      content: item.content,
      project: item.project,
      due: item.due,
      doneDate: item.doneDate ?? today,
      quadrant: item.quadrant
    })
    groups.set(month, list)
  }

  for (const [month, items] of groups) {
    await appendCompleted(vaultPath, month, items)
  }

  const dropLines = new Set(done.map((item) => item.line))
  const lines = raw.split('\n').filter((_line, index) => !dropLines.has(index))
  await writeFile(todoPath, lines.join('\n'), 'utf-8')
}
