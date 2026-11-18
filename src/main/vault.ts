import { app } from 'electron'
import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { UpdateSource } from '@shared/update'

export type ThemeMode = 'light' | 'dark'

export interface AppConfig {
  vaultPath: string | null
  theme: ThemeMode
  secretClearSeconds: number
  lastReminderDate: string | null
  backupReminderEnabled: boolean
  backupReminderTime: string
  lastBackupReminderDate: string | null
  updateCheckEnabled: boolean
  updateSource: UpdateSource
  lastSeenVersion: string | null
  skippedVersion: string | null
  lastUpdateCheck: string | null
}

const DEFAULT_CONFIG: AppConfig = {
  vaultPath: null,
  theme: 'light',
  secretClearSeconds: 12,
  lastReminderDate: null,
  backupReminderEnabled: true,
  backupReminderTime: '18:00',
  lastBackupReminderDate: null,
  updateCheckEnabled: true,
  updateSource: 'auto',
  lastSeenVersion: null,
  skippedVersion: null,
  lastUpdateCheck: null
}
const VAULT_FOLDERS = ['daily', 'weekly', 'projects', 'inbox', '.workrecord']

export function appConfigPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

export async function readAppConfig(): Promise<AppConfig> {
  try {
    const raw = await readFile(appConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export async function updateAppConfig(patch: Partial<AppConfig>): Promise<AppConfig> {
  const current = await readAppConfig()
  const next = { ...current, ...patch }
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(appConfigPath(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}

export async function initializeVault(vaultPath: string): Promise<void> {
  await mkdir(vaultPath, { recursive: true })
  await Promise.all(
    VAULT_FOLDERS.map((name) => mkdir(join(vaultPath, name), { recursive: true }))
  )

  const vaultConfig = join(vaultPath, '.workrecord', 'config.json')
  if (!existsSync(vaultConfig)) {
    const content = JSON.stringify({ version: 1, createdAt: new Date().toISOString() }, null, 2)
    await writeFile(vaultConfig, content, 'utf-8')
  }
}

export function monthFilePath(vaultPath: string, month: string): string {
  return join(vaultPath, 'daily', month.slice(0, 4), `${month}.md`)
}

export function weeklyFilePath(vaultPath: string, week: string): string {
  return join(vaultPath, 'weekly', week.slice(0, 4), `${week}.md`)
}
