import repoConfig from './update-repo.json'

export type UpdateChannel = 'github' | 'gitcode'
export type UpdateSource = 'auto' | UpdateChannel

export interface UpdateManifest {
  version: string
  date?: string
  notes?: string
  downloads?: Record<string, string>
  sha256?: string
}

export interface UpdateProgress {
  received: number
  total: number
  percent: number
}

export interface UpdateCheckResult {
  currentVersion: string
  latestVersion: string | null
  hasUpdate: boolean
  skipped: boolean
  notes: string | null
  date: string | null
  source: UpdateChannel | null
  downloadUrl: string | null
  releasePage: string | null
  sha256: string | null
  checkedAt: string | null
  error: string | null
}

export interface UpdateBootstrap {
  currentVersion: string
  portable: boolean
  notes: Array<{ version: string; date: string; notes: string }>
}

/**
 * 发布仓库地址：GitHub 与 GitCode 分别配置。
 * 修改后需要重新构建，因为地址会编进应用。
 */
export const UPDATE_CHANNELS: Record<UpdateChannel, { manifest: string; releases: string }> = {
  github: {
    manifest: `https://raw.githubusercontent.com/${repoConfig.github.owner}/${repoConfig.github.repo}/${repoConfig.github.branch}/update.json`,
    releases: `https://github.com/${repoConfig.github.owner}/${repoConfig.github.repo}/releases/latest`
  },
  gitcode: {
    manifest: `https://api.gitcode.com/api/v5/repos/${repoConfig.gitcode.owner}/${repoConfig.gitcode.repo}/raw/update.json?ref=${repoConfig.gitcode.branch}`,
    releases: `https://gitcode.com/${repoConfig.gitcode.owner}/${repoConfig.gitcode.repo}/releases`
  }
}

const ALLOWED_DOWNLOAD_HOSTS = [
  'github.com',
  'objects.githubusercontent.com',
  'release-assets.githubusercontent.com',
  'gitee.com',
  'gitee.io'
]

const MAX_NOTES_LENGTH = 20000
const VERSION_RE = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+]([0-9A-Za-z.-]+))?$/

interface ParsedVersion {
  numbers: [number, number, number]
  pre: string | null
}

export function parseVersion(value: string): ParsedVersion | null {
  const match = VERSION_RE.exec(value.trim())
  if (!match) return null
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    pre: match[4] ?? null
  }
}

export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a)
  const right = parseVersion(b)
  if (!left || !right) return 0

  for (let index = 0; index < 3; index += 1) {
    if (left.numbers[index] !== right.numbers[index]) {
      return left.numbers[index] - right.numbers[index]
    }
  }

  if (left.pre === right.pre) return 0
  if (!left.pre) return 1
  if (!right.pre) return -1
  return left.pre.localeCompare(right.pre)
}

export function isAllowedDownloadUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') return false
    return ALLOWED_DOWNLOAD_HOSTS.some(
      (host) => url.hostname === host || url.hostname.endsWith(`.${host}`)
    )
  } catch {
    return false
  }
}

/** 远端清单是不可信输入：只接受结构正确、链接属于可信域名的字段。 */
export function parseManifest(input: unknown): UpdateManifest | null {
  if (!input || typeof input !== 'object') return null
  const record = input as Record<string, unknown>

  const version = typeof record.version === 'string' ? record.version.trim() : ''
  if (!parseVersion(version)) return null

  const notes =
    typeof record.notes === 'string' ? record.notes.slice(0, MAX_NOTES_LENGTH) : undefined
  const date =
    typeof record.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.date)
      ? record.date
      : undefined

  const sha256 =
    typeof record.sha256 === 'string' && /^[0-9a-f]{64}$/i.test(record.sha256)
      ? record.sha256.toLowerCase()
      : undefined

  let downloads: Record<string, string> | undefined
  if (record.downloads && typeof record.downloads === 'object') {
    downloads = {}
    for (const [key, value] of Object.entries(record.downloads as Record<string, unknown>)) {
      if (typeof value !== 'string' || !isAllowedDownloadUrl(value)) continue
      downloads[key] = value
    }
  }

  return { version, notes, date, downloads, sha256 }
}
