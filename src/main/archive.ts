import { existsSync } from 'node:fs'
import {
  copyFile,
  mkdir,
  readdir,
  readFile,
  rename,
  rm,
  rmdir,
  stat,
  writeFile
} from 'node:fs/promises'
import { basename, dirname, join, posix } from 'node:path'
import type { ArchiveEntry, ArchiveFileEntry } from '@shared/api'
import { extractRawLinks, isLinkSource, resolveProjectLink } from './links'
import { assertRelativePath, assertSegment, projectDirPath } from './projects'

const ARCHIVE_ROOT = '.archive'
const WORK_DIR = '.workrecord'
const MANIFEST_FILE = 'archive.json'
const RELATIONS_FILE = 'relations.json'
const MAX_PARSE_BYTES = 1024 * 1024
const MAX_DEPTH = 8

interface ArchiveRecord {
  id: string
  root: string
  name: string
  kind: 'file' | 'folder'
  category: string
  archivedAt: string
  base: string
  moves: string[]
  copies: string[]
}

interface ArchiveManifest {
  version: 1
  records: ArchiveRecord[]
}

interface ManualRelation {
  from: string
  to: string
  type: 'attachment' | 'related'
}

interface RelationsFile {
  version: 1
  relations: ManualRelation[]
}

function projectRoot(vaultPath: string, project: string): string {
  return projectDirPath(vaultPath, project)
}

function absPath(root: string, relative: string): string {
  return join(root, ...relative.split('/'))
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, 'utf-8')) as T
  } catch {
    return null
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temp = `${file}.tmp`
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf-8')
  await rename(temp, file)
}

async function readManifest(root: string): Promise<ArchiveManifest> {
  const parsed = await readJson<ArchiveManifest>(join(root, WORK_DIR, MANIFEST_FILE))
  return parsed?.version === 1 && Array.isArray(parsed.records)
    ? parsed
    : { version: 1, records: [] }
}

async function writeManifest(root: string, manifest: ArchiveManifest): Promise<void> {
  await writeJson(join(root, WORK_DIR, MANIFEST_FILE), manifest)
}

async function readManualRelations(root: string): Promise<ManualRelation[]> {
  const parsed = await readJson<RelationsFile>(join(root, WORK_DIR, RELATIONS_FILE))
  return parsed?.version === 1 && Array.isArray(parsed.relations) ? parsed.relations : []
}

async function walkFiles(
  dir: string,
  prefix: string,
  out: string[],
  depth = 0
): Promise<void> {
  if (depth > MAX_DEPTH) return
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      await walkFiles(join(dir, entry.name), relative, out, depth + 1)
    } else if (entry.isFile()) {
      out.push(relative)
    }
  }
}

async function listProjectTextFiles(root: string): Promise<string[]> {
  const categories = await readdir(root, { withFileTypes: true }).catch(() => [])
  const files: string[] = []
  for (const entry of categories) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    await walkFiles(join(root, entry.name), entry.name, files)
  }
  return files.filter(isLinkSource)
}

/** 当前项目里所有文本链接指向的文件 → 引用它的源文件 */
async function buildReferrers(root: string, manual: ManualRelation[]): Promise<Map<string, Set<string>>> {
  const referrers = new Map<string, Set<string>>()
  const add = (target: string, from: string): void => {
    const set = referrers.get(target) ?? new Set<string>()
    set.add(from)
    referrers.set(target, set)
  }

  for (const from of await listProjectTextFiles(root)) {
    const absolute = absPath(root, from)
    const info = await stat(absolute).catch(() => null)
    if (!info || info.size > MAX_PARSE_BYTES) continue
    const content = await readFile(absolute, 'utf-8').catch(() => null)
    if (!content) continue
    for (const raw of extractRawLinks(content)) {
      const target = resolveProjectLink(from, raw)
      if (target) add(target, from)
    }
  }

  for (const relation of manual) {
    if (relation.type === 'attachment') add(relation.to, relation.from)
  }

  return referrers
}

async function addDependency(
  root: string,
  closure: Set<string>,
  queue: string[],
  target: string
): Promise<void> {
  if (!target || closure.has(target)) return
  const info = await stat(absPath(root, target)).catch(() => null)
  if (!info || !info.isFile()) return
  closure.add(target)
  queue.push(target)
}

async function computeClosure(
  root: string,
  initial: string[],
  manual: ManualRelation[]
): Promise<Set<string>> {
  const closure = new Set(initial)
  const queue = [...initial]

  while (queue.length > 0) {
    const from = queue.shift() as string

    for (const relation of manual) {
      if (relation.from === from && relation.type === 'attachment') {
        await addDependency(root, closure, queue, relation.to)
      }
    }

    if (!isLinkSource(from)) continue
    const absolute = absPath(root, from)
    const info = await stat(absolute).catch(() => null)
    if (!info || info.size > MAX_PARSE_BYTES) continue
    const content = await readFile(absolute, 'utf-8').catch(() => null)
    if (!content) continue

    for (const raw of extractRawLinks(content)) {
      const target = resolveProjectLink(from, raw)
      if (target) await addDependency(root, closure, queue, target)
    }
  }

  return closure
}

async function pruneEmptyDirs(start: string, stop: string): Promise<void> {
  let current = start
  while (current.startsWith(stop) && current !== stop) {
    try {
      await rmdir(current)
    } catch {
      break
    }
    current = dirname(current)
  }
}

export async function archiveNode(
  vaultPath: string,
  project: string,
  category: string,
  relativePath: string,
  kind: 'file' | 'folder'
): Promise<void> {
  const root = projectRoot(vaultPath, project)
  const categoryName = assertSegment(category, '分类名')
  const relative = assertRelativePath(relativePath, '路径')
  if (!relative) throw new Error(kind === 'folder' ? '缺少目录路径' : '缺少文件路径')

  const nodePath = `${categoryName}/${relative}`
  const nodeAbs = absPath(root, nodePath)
  const info = await stat(nodeAbs).catch(() => null)
  if (!info) throw new Error(kind === 'folder' ? '目录不存在' : '文件不存在')
  if (kind === 'folder' && !info.isDirectory()) throw new Error('目录不存在')
  if (kind === 'file' && !info.isFile()) throw new Error('文件不存在')

  const initial: string[] =
    kind === 'file' ? [nodePath] : await (async () => {
      const files: string[] = []
      await walkFiles(nodeAbs, nodePath, files)
      return files
    })()

  const manual = await readManualRelations(root)
  const closure = await computeClosure(root, initial, manual)
  const referrers = await buildReferrers(root, manual)

  const moves: string[] = []
  const copies: string[] = []

  for (const path of closure) {
    const outside = [...(referrers.get(path) ?? [])].some((ref) => !closure.has(ref))
    if (path === nodePath && kind === 'file') {
      moves.push(path)
    } else if (outside) {
      copies.push(path)
    } else {
      moves.push(path)
    }
  }

  const id = `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  const base = `${ARCHIVE_ROOT}/${id}`
  const baseAbs = absPath(root, base)
  await mkdir(baseAbs, { recursive: true })

  for (const path of moves) {
    const source = absPath(root, path)
    if (!existsSync(source)) continue
    const target = absPath(baseAbs, path)
    await mkdir(dirname(target), { recursive: true })
    await rename(source, target)
    await pruneEmptyDirs(dirname(source), absPath(root, categoryName))
  }

  for (const path of copies) {
    const source = absPath(root, path)
    if (!existsSync(source)) continue
    const target = absPath(baseAbs, path)
    if (existsSync(target)) continue
    await mkdir(dirname(target), { recursive: true })
    await copyFile(source, target)
  }

  if (kind === 'folder' && existsSync(nodeAbs)) {
    await pruneEmptyDirs(nodeAbs, absPath(root, categoryName))
  }

  const manifest = await readManifest(root)
  manifest.records.push({
    id,
    root: nodePath,
    name: basename(nodePath),
    kind,
    category: categoryName,
    archivedAt: new Date().toISOString(),
    base,
    moves,
    copies
  })
  await writeManifest(root, manifest)
}

async function listFilesUnder(root: string, base: string): Promise<ArchiveFileEntry[]> {
  const files: string[] = []
  const absoluteBase = absPath(root, base)
  await walkFiles(absoluteBase, '', files)
  const result: ArchiveFileEntry[] = []
  for (const relative of files) {
    const info = await stat(absPath(absoluteBase, relative)).catch(() => null)
    if (!info) continue
    result.push({
      path: relative,
      name: posix.basename(relative),
      size: info.size,
      modified: info.mtime.toISOString()
    })
  }
  result.sort((left, right) => left.path.localeCompare(right.path))
  return result
}

export async function listArchiveEntries(
  vaultPath: string,
  project: string
): Promise<ArchiveEntry[]> {
  const root = projectRoot(vaultPath, project)
  const manifest = await readManifest(root)
  const bases = new Set(manifest.records.map((record) => record.base))
  const entries: ArchiveEntry[] = []

  for (const record of manifest.records) {
    entries.push({
      id: record.id,
      root: record.root,
      name: record.name,
      kind: record.kind,
      category: record.category,
      archivedAt: record.archivedAt,
      files: await listFilesUnder(root, record.base),
      legacy: false
    })
  }

  const legacyFiles: string[] = []
  await walkFiles(absPath(root, ARCHIVE_ROOT), '', legacyFiles)
  for (const relative of legacyFiles) {
    const path = `${ARCHIVE_ROOT}/${relative}`
    if ([...bases].some((base) => path === base || path.startsWith(`${base}/`))) continue
    const info = await stat(absPath(root, path)).catch(() => null)
    if (!info) continue
    entries.push({
      id: `legacy:${relative}`,
      root: relative,
      name: posix.basename(relative),
      kind: 'file',
      category: relative.includes('/') ? relative.slice(0, relative.indexOf('/')) : '',
      archivedAt: info.mtime.toISOString(),
      files: [
        {
          path: relative,
          name: posix.basename(relative),
          size: info.size,
          modified: info.mtime.toISOString()
        }
      ],
      legacy: true
    })
  }

  entries.sort((left, right) => right.archivedAt.localeCompare(left.archivedAt))
  return entries
}

export async function restoreArchiveEntry(
  vaultPath: string,
  project: string,
  id: string
): Promise<void> {
  const root = projectRoot(vaultPath, project)

  if (id.startsWith('legacy:')) {
    const relative = id.slice('legacy:'.length)
    const source = absPath(root, `${ARCHIVE_ROOT}/${relative}`)
    if (!existsSync(source)) throw new Error('归档文件不存在')
    const target = absPath(root, relative)
    if (existsSync(target)) throw new Error(`原位置已有同名文件：${relative}`)
    await mkdir(dirname(target), { recursive: true })
    await rename(source, target)
    await pruneEmptyDirs(dirname(source), absPath(root, ARCHIVE_ROOT))
    return
  }

  const manifest = await readManifest(root)
  const record = manifest.records.find((item) => item.id === id)
  if (!record) throw new Error('归档记录不存在')

  for (const relative of record.moves) {
    const source = absPath(root, `${record.base}/${relative}`)
    if (!existsSync(source)) continue
    const target = absPath(root, relative)
    if (existsSync(target)) throw new Error(`原位置已有同名文件：${relative}`)
    await mkdir(dirname(target), { recursive: true })
    await rename(source, target)
  }

  for (const relative of record.copies) {
    await rm(absPath(root, `${record.base}/${relative}`), { force: true })
  }

  manifest.records = manifest.records.filter((item) => item.id !== id)
  await writeManifest(root, manifest)
  await rm(absPath(root, record.base), { recursive: true, force: true })
}

export async function trashArchiveEntry(
  vaultPath: string,
  project: string,
  id: string,
  trashItem: (target: string) => Promise<void>
): Promise<void> {
  const root = projectRoot(vaultPath, project)

  if (id.startsWith('legacy:')) {
    const relative = id.slice('legacy:'.length)
    const target = absPath(root, `${ARCHIVE_ROOT}/${relative}`)
    if (existsSync(target)) await trashItem(target)
    await pruneEmptyDirs(dirname(target), absPath(root, ARCHIVE_ROOT))
    return
  }

  const manifest = await readManifest(root)
  const record = manifest.records.find((item) => item.id === id)
  if (!record) throw new Error('归档记录不存在')

  const baseAbs = absPath(root, record.base)
  if (existsSync(baseAbs)) await trashItem(baseAbs)
  manifest.records = manifest.records.filter((item) => item.id !== id)
  await writeManifest(root, manifest)
}

export async function archivedFilePath(
  vaultPath: string,
  project: string,
  id: string,
  relativePath: string
): Promise<string> {
  const root = projectRoot(vaultPath, project)

  if (id.startsWith('legacy:')) {
    const relative = id.slice('legacy:'.length)
    return absPath(root, `${ARCHIVE_ROOT}/${relative}`)
  }

  const manifest = await readManifest(root)
  const record = manifest.records.find((item) => item.id === id)
  if (!record) throw new Error('归档记录不存在')

  const safe = assertRelativePath(relativePath, '路径')
  if (!safe) throw new Error('缺少文件路径')
  if (!record.moves.includes(safe) && !record.copies.includes(safe)) {
    throw new Error('文件不在该归档记录中')
  }

  return absPath(root, `${record.base}/${safe}`)
}
