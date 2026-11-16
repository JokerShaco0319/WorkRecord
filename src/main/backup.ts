import { copyFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const KEEP = 7

async function exists(path: string): Promise<boolean> {
  return stat(path).then(
    () => true,
    () => false
  )
}

async function collectMarkdown(dir: string, out: string[]): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) await collectMarkdown(abs, out)
    else if (entry.name.toLowerCase().endsWith('.md')) out.push(abs)
  }
}

async function prune(root: string, current: string): Promise<void> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => [])
  const dirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a))

  for (const name of dirs.slice(KEEP)) {
    if (name === current) continue
    await rm(join(root, name), { recursive: true, force: true }).catch(() => {})
  }
}

/** 每天首次启动时把 Markdown 记录快照到 .workrecord/backups/YYYY-MM-DD */
export async function backupVault(vaultPath: string, today: string): Promise<void> {
  const root = join(vaultPath, '.workrecord', 'backups')
  const target = join(root, today)
  if (await exists(target)) return

  await mkdir(target, { recursive: true })

  const files: string[] = []
  for (const folder of ['daily', 'weekly', 'projects']) {
    await collectMarkdown(join(vaultPath, folder), files)
  }
  const todo = join(vaultPath, 'todo.md')
  if (await exists(todo)) files.push(todo)

  for (const file of files) {
    const rel = file.slice(vaultPath.length + 1)
    const dest = join(target, rel)
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(file, dest).catch(() => {})
  }

  await prune(root, today)
}
