import { existsSync } from 'node:fs'
import { copyFile, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, resolve } from 'node:path'
import type {
  ProjectDetail,
  ProjectFileInfo,
  ProjectFolderInfo,
  ProjectSummary
} from '@shared/api'
import type { ProjectStatus } from '@shared/md/project'
import {
  DEFAULT_CATEGORIES,
  addCategoryToRaw,
  parseProject,
  projectTemplate,
  setStatusInRaw
} from '@shared/md/project'

const PROJECT_FILE = '_project.md'
const INVALID_SEGMENT = /[\\/:*?"<>|]/
const MAX_DEPTH = 8

export function assertSegment(value: string, label: string): string {
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label}不能为空`)
  if (trimmed.startsWith('.') || INVALID_SEGMENT.test(trimmed)) {
    throw new Error(`${label}包含非法字符`)
  }
  return trimmed
}

/** 校验「a/b/c」形式的相对路径，返回规范化后的值；空串表示分类根目录 */
export function assertRelativePath(value: string, label: string): string {
  const normalized = value.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  if (!normalized) return ''

  const segments = normalized.split('/')
  for (const segment of segments) assertSegment(segment, label)
  return segments.join('/')
}

export function projectsRoot(vaultPath: string): string {
  return join(vaultPath, 'projects')
}

export function projectDirPath(vaultPath: string, project: string): string {
  return join(projectsRoot(vaultPath), assertSegment(project, '项目名'))
}

export function categoryDirPath(vaultPath: string, project: string, category: string): string {
  return join(projectDirPath(vaultPath, project), assertSegment(category, '分类名'))
}

/** 把分类内的相对路径解析成绝对路径 */
export function resolveInsideCategory(
  vaultPath: string,
  project: string,
  category: string,
  relativePath: string
): string {
  const base = categoryDirPath(vaultPath, project, category)
  const safe = assertRelativePath(relativePath, '路径')
  return safe ? join(base, ...safe.split('/')) : base
}

export async function createProject(
  vaultPath: string,
  name: string,
  created: string
): Promise<void> {
  const dir = projectDirPath(vaultPath, name)
  if (existsSync(dir)) throw new Error('同名项目已存在')

  await mkdir(dir, { recursive: true })
  for (const category of DEFAULT_CATEGORIES) {
    await mkdir(join(dir, category), { recursive: true })
  }
  await writeFile(join(dir, PROJECT_FILE), projectTemplate(name.trim(), created), 'utf-8')
}

interface WalkedFile {
  path: string
  name: string
  size: number
  modified: string
}

async function walkCategory(
  dir: string,
  prefix: string,
  depth: number,
  files: WalkedFile[],
  folders: string[]
): Promise<void> {
  if (depth > MAX_DEPTH) return

  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const relative = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      folders.push(relative)
      await walkCategory(join(dir, entry.name), relative, depth + 1, files, folders)
      continue
    }

    if (!entry.isFile()) continue
    const info = await stat(join(dir, entry.name)).catch(() => null)
    if (!info) continue
    files.push({
      path: relative,
      name: entry.name,
      size: info.size,
      modified: info.mtime.toISOString()
    })
  }
}

export async function readProject(vaultPath: string, name: string): Promise<ProjectDetail> {
  const dir = projectDirPath(vaultPath, name)

  let meta = {
    created: '',
    categories: [...DEFAULT_CATEGORIES],
    status: 'active' as ProjectStatus
  }
  let description = ''
  try {
    const doc = parseProject(await readFile(join(dir, PROJECT_FILE), 'utf-8'))
    meta = doc.meta
    description = doc.description
  } catch {
    // 元文件缺失时按默认分类展示
  }

  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const folders = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .sort()

  const categories = [...meta.categories]
  for (const folder of folders) {
    if (!categories.includes(folder)) categories.push(folder)
  }

  const files: ProjectFileInfo[] = []
  const folderInfos: ProjectFolderInfo[] = []

  for (const category of categories) {
    const walked: WalkedFile[] = []
    const nested: string[] = []
    await walkCategory(join(dir, category), '', 0, walked, nested)

    for (const file of walked) {
      files.push({ category, path: file.path, name: file.name, size: file.size, modified: file.modified })
    }
    for (const folder of nested) {
      folderInfos.push({ category, path: folder })
    }
  }

  files.sort((a, b) => a.category.localeCompare(b.category) || a.path.localeCompare(b.path))
  folderInfos.sort(
    (a, b) => a.category.localeCompare(b.category) || a.path.localeCompare(b.path)
  )

  const updatedAt = files.reduce<string | null>(
    (latest, file) => (!latest || file.modified > latest ? file.modified : latest),
    null
  )

  return {
    name: name.trim(),
    description,
    categories,
    status: meta.status,
    fileCount: files.length,
    updatedAt,
    files,
    folders: folderInfos
  }
}

export async function listProjects(vaultPath: string): Promise<ProjectSummary[]> {
  const entries = await readdir(projectsRoot(vaultPath), { withFileTypes: true }).catch(() => [])
  const projects: ProjectSummary[] = []

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const detail = await readProject(vaultPath, entry.name).catch(() => null)
    if (!detail) continue
    const { files: _files, folders: _folders, ...summary } = detail
    projects.push(summary)
  }

  projects.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
  return projects
}

export async function addCategory(
  vaultPath: string,
  name: string,
  category: string,
  created: string
): Promise<void> {
  const dir = projectDirPath(vaultPath, name)
  const trimmed = assertSegment(category, '分类名')

  await mkdir(join(dir, trimmed), { recursive: true })

  const metaPath = join(dir, PROJECT_FILE)
  let raw: string
  try {
    raw = await readFile(metaPath, 'utf-8')
  } catch {
    raw = projectTemplate(name.trim(), created)
  }

  if (!parseProject(raw).meta.categories.includes(trimmed)) {
    await writeFile(metaPath, addCategoryToRaw(raw, trimmed), 'utf-8')
  }
}

async function uniqueTargetPath(dir: string, fileName: string): Promise<string> {
  const ext = extname(fileName)
  const base = basename(fileName, ext)
  let candidate = fileName
  let index = 1
  while (existsSync(join(dir, candidate))) {
    candidate = `${base} (${index})${ext}`
    index++
  }
  return join(dir, candidate)
}

export async function importFiles(
  vaultPath: string,
  project: string,
  category: string,
  dir: string,
  sourcePaths: string[]
): Promise<void> {
  const targetDir = resolveInsideCategory(vaultPath, project, category, dir)
  await mkdir(targetDir, { recursive: true })

  for (const source of sourcePaths) {
    const info = await stat(source).catch(() => null)
    if (!info || !info.isFile()) continue

    const target = await uniqueTargetPath(targetDir, basename(source))
    if (resolve(target) === resolve(source)) continue
    await copyFile(source, target)
  }
}

export async function createFolder(
  vaultPath: string,
  project: string,
  category: string,
  dir: string,
  name: string
): Promise<void> {
  const parent = assertRelativePath(dir, '路径')
  const folderName = assertSegment(name, '目录名')
  const target = resolveInsideCategory(
    vaultPath,
    project,
    category,
    parent ? `${parent}/${folderName}` : folderName
  )

  if (existsSync(target)) throw new Error('同名目录已存在')
  await mkdir(target, { recursive: true })
}

export async function setProjectStatus(
  vaultPath: string,
  name: string,
  status: ProjectStatus
): Promise<void> {
  const dir = projectDirPath(vaultPath, name)
  const metaPath = join(dir, PROJECT_FILE)

  let raw: string
  try {
    raw = await readFile(metaPath, 'utf-8')
  } catch {
    raw = projectTemplate(name.trim(), '')
  }

  await writeFile(metaPath, setStatusInRaw(raw, status), 'utf-8')
}

export async function renameFile(
  vaultPath: string,
  project: string,
  category: string,
  filePath: string,
  newName: string
): Promise<void> {
  const source = resolveInsideCategory(vaultPath, project, category, filePath)
  const relative = assertRelativePath(filePath, '路径')
  if (!relative) throw new Error('缺少文件路径')

  const dirPart = relative.includes('/') ? relative.slice(0, relative.lastIndexOf('/')) : ''
  const targetName = assertSegment(newName, '文件名')
  const target = resolveInsideCategory(
    vaultPath,
    project,
    category,
    dirPart ? `${dirPart}/${targetName}` : targetName
  )

  if (resolve(source) === resolve(target)) return
  if (existsSync(target)) throw new Error('同名文件已存在')
  await rename(source, target)
}

export async function moveFile(
  vaultPath: string,
  project: string,
  category: string,
  filePath: string,
  toCategory: string
): Promise<void> {
  const source = resolveInsideCategory(vaultPath, project, category, filePath)
  const targetDir = categoryDirPath(vaultPath, project, toCategory)
  await mkdir(targetDir, { recursive: true })

  const target = await uniqueTargetPath(targetDir, basename(source))
  if (resolve(target) === resolve(source)) return
  await rename(source, target)
}
