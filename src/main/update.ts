import { app, net, shell } from 'electron'
import { existsSync } from 'node:fs'
import { notesBetween, type ReleaseNote } from '@shared/changelog'
import {
  UPDATE_CHANNELS,
  compareVersions,
  isAllowedDownloadUrl,
  parseManifest,
  type UpdateChannel,
  type UpdateCheckResult,
  type UpdateManifest,
  type UpdateSource
} from '@shared/update'
import { appConfigPath, readAppConfig, updateAppConfig } from './vault'

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000
const REQUEST_TIMEOUT_MS = 8000
const MAX_MANIFEST_LENGTH = 200_000

let cached: { source: UpdateSource; result: UpdateCheckResult } | null = null
let inflight: Promise<UpdateCheckResult> | null = null

export function currentVersion(): string {
  return app.getVersion()
}

export function invalidateUpdateCache(): void {
  cached = null
}

/**
 * 启动时读取本地更新日志：升级到新版本后的首次启动会返回本次更新内容。
 * 新安装（没有配置文件）不弹更新说明。
 */
export async function bootstrapUpdate(): Promise<{
  currentVersion: string
  notes: ReleaseNote[]
}> {
  const current = currentVersion()
  const hadConfig = existsSync(appConfigPath())
  const config = await readAppConfig()

  if (!config.lastSeenVersion) {
    const notes = hadConfig ? notesBetween('0.0.0', current) : []
    await updateAppConfig({ lastSeenVersion: current })
    return { currentVersion: current, notes }
  }

  if (compareVersions(config.lastSeenVersion, current) < 0) {
    const notes = notesBetween(config.lastSeenVersion, current)
    await updateAppConfig({ lastSeenVersion: current })
    return { currentVersion: current, notes }
  }

  return { currentVersion: current, notes: [] }
}

export async function checkForUpdate(manual: boolean): Promise<UpdateCheckResult> {
  const current = currentVersion()
  const config = await readAppConfig()

  if (!manual) {
    if (!config.updateCheckEnabled) return emptyResult(current, '自动检查已关闭')

    const cachedResult =
      cached && cached.source === config.updateSource ? cached.result : null
    if (
      cachedResult?.checkedAt &&
      Date.now() - Date.parse(cachedResult.checkedAt) < CHECK_INTERVAL_MS
    ) {
      return cachedResult
    }
  }

  if (inflight) return inflight

  inflight = runCheck(config.updateSource, current)
    .then(async (result) => {
      cached = { source: config.updateSource, result }
      if (result.checkedAt) await updateAppConfig({ lastUpdateCheck: result.checkedAt })
      return result
    })
    .finally(() => {
      inflight = null
    })

  return inflight
}

export async function dismissVersion(version: string): Promise<void> {
  await updateAppConfig({ skippedVersion: version })
}

export async function openUpdateUrl(url: string): Promise<void> {
  if (!isAllowedDownloadUrl(url)) throw new Error('不信任的下载地址')
  await shell.openExternal(url)
}

async function runCheck(source: UpdateSource, current: string): Promise<UpdateCheckResult> {
  const checkedAt = new Date().toISOString()
  const channels: UpdateChannel[] = source === 'auto' ? ['gitcode', 'github'] : [source]

  const settled = await Promise.allSettled(channels.map((channel) => fetchManifest(channel)))
  const found: Array<{ channel: UpdateChannel; manifest: UpdateManifest }> = []
  settled.forEach((item, index) => {
    if (item.status === 'fulfilled' && item.value) {
      found.push({ channel: channels[index], manifest: item.value })
    }
  })

  if (found.length === 0) {
    return emptyResult(current, '无法连接更新服务器，请检查网络后重试', checkedAt)
  }

  // 两个源版本相同时优先用 GitCode（国内访问更稳定）
  found.sort(
    (left, right) =>
      compareVersions(right.manifest.version, left.manifest.version) ||
      (left.channel === 'gitcode' ? -1 : 1)
  )
  const best = found[0]
  const config = await readAppConfig()
  const downloadable = pickDownload(best.manifest, best.channel)

  return {
    currentVersion: current,
    latestVersion: best.manifest.version,
    hasUpdate: compareVersions(best.manifest.version, current) > 0,
    skipped: config.skippedVersion === best.manifest.version,
    notes: best.manifest.notes ?? null,
    date: best.manifest.date ?? null,
    source: best.channel,
    downloadUrl: downloadable,
    releasePage: UPDATE_CHANNELS[best.channel].releases,
    checkedAt,
    error: null
  }
}

async function fetchManifest(channel: UpdateChannel): Promise<UpdateManifest | null> {
  const url = process.env.WORKRECORD_UPDATE_MANIFEST || UPDATE_CHANNELS[channel].manifest
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await net.fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': `WorkRecord/${currentVersion()}`
      }
    })
    if (!response.ok) return null

    const text = await response.text()
    if (text.length > MAX_MANIFEST_LENGTH) return null
    return parseManifest(JSON.parse(text))
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function pickDownload(manifest: UpdateManifest, channel: UpdateChannel): string | null {
  const candidates = [manifest.downloads?.[channel], manifest.downloads?.default]
  for (const url of candidates) {
    if (url && isAllowedDownloadUrl(url)) return url
  }
  return null
}

function emptyResult(
  currentVersion: string,
  error: string,
  checkedAt: string | null = null
): UpdateCheckResult {
  return {
    currentVersion,
    latestVersion: null,
    hasUpdate: false,
    skipped: false,
    notes: null,
    date: null,
    source: null,
    downloadUrl: null,
    releasePage: null,
    checkedAt,
    error
  }
}
