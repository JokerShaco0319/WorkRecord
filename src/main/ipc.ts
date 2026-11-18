import { app, BrowserWindow, clipboard, dialog, ipcMain, shell } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  AppSettings,
  Asset,
  BackupInfo,
  CompletedTodo,
  MonthFile,
  ProjectDetail,
  SecurityStatus,
  StatsReport,
  VaultInfo,
  WeeklyPreview
} from '@shared/api'
import { formatDateKey, formatTimeHm, monthKeyForDate } from '@shared/date'
import type { ProjectStatus } from '@shared/md/project'
import type { DayDoc, EntryInput, EntryTarget } from '@shared/md/month'
import type { UpdateSource } from '@shared/update'
import {
  appendEntry,
  dayDoc,
  monthTemplate,
  parseMonth,
  removeEntry,
  serializeEntry,
  updateEntry
} from '@shared/md/month'
import type { Quadrant, TodoDoc, TodoInput, TodoTarget } from '@shared/md/todo'
import {
  addTodo,
  moveTodo,
  parseTodo,
  removeTodo,
  todoTemplate,
  toggleTodo,
  updateTodo
} from '@shared/md/todo'
import type { ArchiveTarget } from '@shared/md/todoArchive'
import {
  buildWeeklyBody,
  buildWeeklyFile,
  collectWeekEntries,
  mergeAutoBlock,
  weekRangeFromKey
} from '@shared/md/weekly'
import { createBackup, listBackups, restoreBackup } from './backup'
import {
  addCategory,
  createFolder,
  createProject,
  importFiles,
  listProjects,
  moveFile,
  projectDirPath,
  readProject,
  renameFile,
  renameFolder,
  resolveInsideCategory,
  setProjectStatus
} from './projects'
import { listAssets, removeAsset, saveAsset } from './assets'
import { closeCapture, resizeCapture } from './capture'
import { listTags, searchVault } from './search'
import {
  isConfigured,
  isUnlocked,
  lockSession,
  setupPassword,
  unlockSession
} from './security'
import { computeStats, monthsBetween } from './stats'
import { appendCompleted, listArchive, removeArchived } from './todoArchive'
import {
  bootstrapUpdate,
  checkForUpdate,
  dismissVersion,
  invalidateUpdateCache,
  openUpdateUrl
} from './update'
import type { AppConfig } from './vault'
import {
  initializeVault,
  monthFilePath,
  readAppConfig,
  updateAppConfig,
  weeklyFilePath
} from './vault'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MONTH_RE = /^\d{4}-\d{2}$/

function assertDate(date: string): void {
  if (!DATE_RE.test(date)) throw new Error(`非法的日期：${date}`)
}

function assertMonth(month: string): void {
  if (!MONTH_RE.test(month)) throw new Error(`非法的月份：${month}`)
}

const QUADRANT_KEYS: Quadrant[] = ['q1', 'q2', 'q3', 'q4']

function assertQuadrant(value: string): asserts value is Quadrant {
  if (!QUADRANT_KEYS.includes(value as Quadrant)) throw new Error(`非法的象限：${value}`)
}

const WEEK_RE = /^\d{4}-W\d{2}$/

function assertWeek(week: string): void {
  if (!WEEK_RE.test(week)) throw new Error(`非法的周次：${week}`)
}

let clipboardClearTimer: NodeJS.Timeout | null = null

function currentSettings(config: AppConfig): AppSettings {
  return {
    theme: config.theme,
    secretClearSeconds: config.secretClearSeconds,
    launchAtLogin: app.getLoginItemSettings().openAtLogin,
    backupReminderEnabled: config.backupReminderEnabled,
    backupReminderTime: config.backupReminderTime,
    updateCheckEnabled: config.updateCheckEnabled,
    updateSource: config.updateSource
  }
}

async function requireVault(): Promise<string> {
  const config = await readAppConfig()
  if (!config.vaultPath) throw new Error('尚未选择数据目录')
  return config.vaultPath
}

async function readMonthRaw(vaultPath: string, month: string): Promise<string> {
  try {
    return await readFile(monthFilePath(vaultPath, month), 'utf-8')
  } catch {
    return monthTemplate(month)
  }
}

async function writeMonthRaw(vaultPath: string, month: string, raw: string): Promise<void> {
  const filePath = monthFilePath(vaultPath, month)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, raw, 'utf-8')
}

function todoFilePath(vaultPath: string): string {
  return join(vaultPath, 'todo.md')
}

async function readTodoRaw(vaultPath: string): Promise<string> {
  try {
    return await readFile(todoFilePath(vaultPath), 'utf-8')
  } catch {
    return todoTemplate()
  }
}

async function writeTodoRaw(vaultPath: string, raw: string): Promise<void> {
  await writeFile(todoFilePath(vaultPath), raw, 'utf-8')
}

async function weeklyContext(vaultPath: string, week: string) {
  assertWeek(week)
  const range = weekRangeFromKey(week)
  const month = range.start.slice(0, 7)
  const monthDoc = parseMonth(month, await readMonthRaw(vaultPath, month))
  return {
    range,
    entries: collectWeekEntries(monthDoc, range.start, range.end),
    todos: parseTodo(await readTodoRaw(vaultPath)).items
  }
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle('vault:get', async (): Promise<VaultInfo> => {
    const config = await readAppConfig()
    return { path: config.vaultPath }
  })

  ipcMain.handle('vault:choose', async (): Promise<VaultInfo> => {
    const window = getWindow()
    const options: Electron.OpenDialogOptions = {
      title: '选择数据目录',
      buttonLabel: '使用此目录',
      properties: ['openDirectory', 'createDirectory']
    }
    const result = window
      ? await dialog.showOpenDialog(window, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) {
      const config = await readAppConfig()
      return { path: config.vaultPath }
    }

    const vaultPath = result.filePaths[0]
    await initializeVault(vaultPath)
    await updateAppConfig({ vaultPath })
    return { path: vaultPath }
  })

  ipcMain.handle('daily:read', async (_event, date: string): Promise<DayDoc> => {
    assertDate(date)
    const vaultPath = await requireVault()
    const month = monthKeyForDate(date)
    return dayDoc(parseMonth(month, await readMonthRaw(vaultPath, month)), date)
  })

  ipcMain.handle(
    'daily:append-entry',
    async (_event, date: string, input: EntryInput): Promise<DayDoc> => {
      assertDate(date)
      const vaultPath = await requireVault()
      const month = monthKeyForDate(date)
      const raw = await readMonthRaw(vaultPath, month)
      const next = appendEntry(raw, month, date, serializeEntry(input))

      await writeMonthRaw(vaultPath, month, next)
      return dayDoc(parseMonth(month, next), date)
    }
  )

  ipcMain.handle(
    'daily:update-entry',
    async (
      _event,
      date: string,
      target: EntryTarget,
      input: EntryInput
    ): Promise<DayDoc> => {
      assertDate(date)
      const vaultPath = await requireVault()
      const month = monthKeyForDate(date)
      const raw = await readMonthRaw(vaultPath, month)
      const next = updateEntry(raw, month, date, target, serializeEntry(input))

      await writeMonthRaw(vaultPath, month, next)
      return dayDoc(parseMonth(month, next), date)
    }
  )

  ipcMain.handle('daily:remove-entry', async (_event, date: string, target: EntryTarget) => {
    assertDate(date)
    const vaultPath = await requireVault()
    const month = monthKeyForDate(date)
    const raw = await readMonthRaw(vaultPath, month)
    const next = removeEntry(raw, month, date, target)

    await writeMonthRaw(vaultPath, month, next)
    return dayDoc(parseMonth(month, next), date)
  })

  ipcMain.handle('daily:read-month', async (_event, month: string): Promise<MonthFile> => {
    assertMonth(month)
    const vaultPath = await requireVault()
    return { month, raw: await readMonthRaw(vaultPath, month) }
  })

  ipcMain.handle(
    'daily:save-month',
    async (_event, month: string, raw: string): Promise<MonthFile> => {
      assertMonth(month)
      const vaultPath = await requireVault()
      await writeMonthRaw(vaultPath, month, raw)
      return { month, raw }
    }
  )

  ipcMain.handle('todo:read', async (): Promise<TodoDoc> => {
    const vaultPath = await requireVault()
    return parseTodo(await readTodoRaw(vaultPath))
  })

  ipcMain.handle(
    'todo:add',
    async (_event, quadrant: Quadrant, input: TodoInput): Promise<TodoDoc> => {
      assertQuadrant(quadrant)
      const vaultPath = await requireVault()
      const next = addTodo(await readTodoRaw(vaultPath), quadrant, input)
      await writeTodoRaw(vaultPath, next)
      return parseTodo(next)
    }
  )

  ipcMain.handle(
    'todo:update',
    async (_event, target: TodoTarget, input: TodoInput): Promise<TodoDoc> => {
      const vaultPath = await requireVault()
      const next = updateTodo(await readTodoRaw(vaultPath), target, input)
      await writeTodoRaw(vaultPath, next)
      return parseTodo(next)
    }
  )

  ipcMain.handle('todo:remove', async (_event, target: TodoTarget): Promise<TodoDoc> => {
    const vaultPath = await requireVault()
    const next = removeTodo(await readTodoRaw(vaultPath), target)
    await writeTodoRaw(vaultPath, next)
    return parseTodo(next)
  })

  ipcMain.handle(
    'todo:move',
    async (_event, target: TodoTarget, quadrant: Quadrant): Promise<TodoDoc> => {
      assertQuadrant(quadrant)
      const vaultPath = await requireVault()
      const next = moveTodo(await readTodoRaw(vaultPath), target, quadrant)
      await writeTodoRaw(vaultPath, next)
      return parseTodo(next)
    }
  )

  ipcMain.handle('todo:toggle', async (_event, target: TodoTarget): Promise<TodoDoc> => {
    const vaultPath = await requireVault()
    const raw = await readTodoRaw(vaultPath)

    const item = parseTodo(raw).items.find((entry) => entry.line === target.line)
    if (!item) throw new Error('未找到对应待办，文件可能已被外部修改')
    if (item.raw !== target.raw) throw new Error('待办内容已变化，请刷新后重试')

    const today = formatDateKey(new Date())

    if (!item.done) {
      await appendCompleted(vaultPath, today.slice(0, 7), [
        {
          content: item.content,
          project: item.project,
          due: item.due,
          doneDate: today,
          quadrant: item.quadrant
        }
      ])
      const next = removeTodo(raw, target)
      await writeTodoRaw(vaultPath, next)
      return parseTodo(next)
    }

    const next = toggleTodo(raw, target, today)
    await writeTodoRaw(vaultPath, next)
    return parseTodo(next)
  })

  ipcMain.handle('todo:archive', async (_event, month: string) => {
    assertMonth(month)
    const vaultPath = await requireVault()
    return listArchive(vaultPath, month)
  })

  ipcMain.handle('todo:restore', async (_event, month: string, target: ArchiveTarget) => {
    assertMonth(month)
    const vaultPath = await requireVault()

    const item = (await listArchive(vaultPath, month)).find((entry) => entry.line === target.line)
    if (!item) throw new Error('未找到对应的归档事项')
    if (item.raw !== target.raw) throw new Error('归档内容已变化，请刷新后重试')

    const archived = await removeArchived(vaultPath, month, target)
    const next = addTodo(await readTodoRaw(vaultPath), item.quadrant, {
      content: item.content,
      due: item.due,
      project: item.project
    })
    await writeTodoRaw(vaultPath, next)
    return archived
  })

  ipcMain.handle('vault:reveal', async (): Promise<void> => {
    const vaultPath = await requireVault()
    await shell.openPath(vaultPath)
  })

  ipcMain.handle('projects:list', async () => {
    const vaultPath = await requireVault()
    return listProjects(vaultPath)
  })

  ipcMain.handle('projects:create', async (_event, name: string): Promise<ProjectDetail> => {
    const vaultPath = await requireVault()
    await createProject(vaultPath, name, formatDateKey(new Date()))
    return readProject(vaultPath, name.trim())
  })

  ipcMain.handle('projects:read', async (_event, name: string): Promise<ProjectDetail> => {
    const vaultPath = await requireVault()
    return readProject(vaultPath, name)
  })

  ipcMain.handle(
    'projects:add-category',
    async (_event, name: string, category: string): Promise<ProjectDetail> => {
      const vaultPath = await requireVault()
      await addCategory(vaultPath, name, category, formatDateKey(new Date()))
      return readProject(vaultPath, name)
    }
  )

  ipcMain.handle('projects:reveal', async (_event, name: string): Promise<void> => {
    const vaultPath = await requireVault()
    await shell.openPath(projectDirPath(vaultPath, name))
  })

  ipcMain.handle(
    'files:import',
    async (
      _event,
      project: string,
      category: string,
      dir: string
    ): Promise<ProjectDetail | null> => {
      const vaultPath = await requireVault()
      const window = getWindow()
      const options: Electron.OpenDialogOptions = {
        title: '选择要导入的文件',
        buttonLabel: '导入',
        properties: ['openFile', 'multiSelections']
      }
      const result = window
        ? await dialog.showOpenDialog(window, options)
        : await dialog.showOpenDialog(options)

      if (result.canceled || result.filePaths.length === 0) return null

      await importFiles(vaultPath, project, category, dir, result.filePaths)
      return readProject(vaultPath, project)
    }
  )

  ipcMain.handle(
    'files:import-paths',
    async (
      _event,
      project: string,
      category: string,
      dir: string,
      paths: string[]
    ): Promise<ProjectDetail> => {
      const vaultPath = await requireVault()
      await importFiles(vaultPath, project, category, dir, paths)
      return readProject(vaultPath, project)
    }
  )

  ipcMain.handle(
    'files:open',
    async (_event, project: string, category: string, path: string): Promise<void> => {
      const vaultPath = await requireVault()
      const error = await shell.openPath(resolveInsideCategory(vaultPath, project, category, path))
      if (error) throw new Error(error)
    }
  )

  ipcMain.handle(
    'files:reveal',
    async (_event, project: string, category: string, path: string): Promise<void> => {
      const vaultPath = await requireVault()
      shell.showItemInFolder(resolveInsideCategory(vaultPath, project, category, path))
    }
  )

  ipcMain.handle(
    'files:trash',
    async (
      _event,
      project: string,
      category: string,
      path: string
    ): Promise<ProjectDetail> => {
      const vaultPath = await requireVault()
      await shell.trashItem(resolveInsideCategory(vaultPath, project, category, path))
      return readProject(vaultPath, project)
    }
  )

  ipcMain.handle(
    'projects:set-status',
    async (_event, name: string, status: ProjectStatus): Promise<ProjectDetail> => {
      if (status !== 'active' && status !== 'paused' && status !== 'archived') {
        throw new Error(`非法的项目状态：${status}`)
      }
      const vaultPath = await requireVault()
      await setProjectStatus(vaultPath, name, status)
      return readProject(vaultPath, name)
    }
  )

  ipcMain.handle(
    'files:rename',
    async (
      _event,
      project: string,
      category: string,
      path: string,
      newName: string
    ): Promise<ProjectDetail> => {
      const vaultPath = await requireVault()
      await renameFile(vaultPath, project, category, path, newName)
      return readProject(vaultPath, project)
    }
  )

  ipcMain.handle(
    'files:rename-folder',
    async (
      _event,
      project: string,
      category: string,
      path: string,
      newName: string
    ): Promise<ProjectDetail> => {
      const vaultPath = await requireVault()
      await renameFolder(vaultPath, project, category, path, newName)
      return readProject(vaultPath, project)
    }
  )

  ipcMain.handle(
    'files:move',
    async (
      _event,
      project: string,
      category: string,
      path: string,
      toCategory: string
    ): Promise<ProjectDetail> => {
      const vaultPath = await requireVault()
      await moveFile(vaultPath, project, category, path, toCategory)
      return readProject(vaultPath, project)
    }
  )

  ipcMain.handle(
    'files:create-folder',
    async (
      _event,
      project: string,
      category: string,
      dir: string,
      name: string
    ): Promise<ProjectDetail> => {
      const vaultPath = await requireVault()
      await createFolder(vaultPath, project, category, dir, name)
      return readProject(vaultPath, project)
    }
  )

  ipcMain.handle('backups:list', async (): Promise<BackupInfo[]> => {
    const vaultPath = await requireVault()
    return listBackups(vaultPath)
  })

  ipcMain.handle('backups:create', async (): Promise<number> => {
    const vaultPath = await requireVault()
    return createBackup(vaultPath, formatDateKey(new Date()))
  })

  ipcMain.handle('backups:restore', async (_event, date: string): Promise<number> => {
    const vaultPath = await requireVault()

    const window = getWindow()
    const options: Electron.MessageBoxOptions = {
      type: 'warning',
      buttons: ['恢复', '取消'],
      defaultId: 1,
      cancelId: 1,
      title: '恢复备份',
      message: `用 ${date} 的备份覆盖当前所有 Markdown 记录？`,
      detail: '当前内容会被快照中的版本替换，无法撤销。项目里的其他文件不受影响。'
    }
    const result = window
      ? await dialog.showMessageBox(window, options)
      : await dialog.showMessageBox(options)

    if (result.response !== 0) return 0
    return restoreBackup(vaultPath, date)
  })

  ipcMain.handle('weekly:preview', async (_event, week: string): Promise<WeeklyPreview> => {
    const vaultPath = await requireVault()
    const { range, entries, todos } = await weeklyContext(vaultPath, week)
    const body = buildWeeklyBody(entries, todos, range.end)

    return {
      week: range.key,
      start: range.start,
      end: range.end,
      title: range.title,
      body,
      entryCount: entries.length,
      projectCount: new Set(entries.map((entry) => entry.project ?? '其他')).size
    }
  })

  ipcMain.handle('weekly:read', async (_event, week: string): Promise<string | null> => {
    assertWeek(week)
    const vaultPath = await requireVault()
    return readFile(weeklyFilePath(vaultPath, week), 'utf-8').catch(() => null)
  })

  ipcMain.handle('weekly:generate', async (_event, week: string): Promise<string> => {
    const vaultPath = await requireVault()
    const { range, entries, todos } = await weeklyContext(vaultPath, week)
    const body = buildWeeklyBody(entries, todos, range.end)

    const filePath = weeklyFilePath(vaultPath, week)
    const existing = await readFile(filePath, 'utf-8').catch(() => null)
    const next = existing ? mergeAutoBlock(existing, body) : buildWeeklyFile(range, body)

    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, next, 'utf-8')
    return next
  })

  ipcMain.handle(
    'weekly:save',
    async (_event, week: string, raw: string): Promise<string> => {
      assertWeek(week)
      const vaultPath = await requireVault()
      const filePath = weeklyFilePath(vaultPath, week)
      await mkdir(dirname(filePath), { recursive: true })
      await writeFile(filePath, raw, 'utf-8')
      return raw
    }
  )

  ipcMain.handle(
    'weekly:export',
    async (_event, week: string, text: string): Promise<boolean> => {
      assertWeek(week)

      const window = getWindow()
      const options: Electron.SaveDialogOptions = {
        title: '导出周报',
        defaultPath: `${week} 周报.md`,
        filters: [{ name: 'Markdown', extensions: ['md'] }]
      }
      const result = window
        ? await dialog.showSaveDialog(window, options)
        : await dialog.showSaveDialog(options)

      if (result.canceled || !result.filePath) return false
      await writeFile(result.filePath, text, 'utf-8')
      return true
    }
  )

  ipcMain.handle('settings:get', async (): Promise<AppSettings> => {
    return currentSettings(await readAppConfig())
  })

  ipcMain.handle(
    'settings:set-theme',
    async (_event, theme: 'light' | 'dark'): Promise<AppSettings> => {
      if (theme !== 'light' && theme !== 'dark') throw new Error(`非法的主题：${theme}`)
      return currentSettings(await updateAppConfig({ theme }))
    }
  )

  ipcMain.handle(
    'settings:set-secret-clear-seconds',
    async (_event, seconds: number): Promise<AppSettings> => {
      if (!Number.isFinite(seconds) || seconds < 1 || seconds > 300) {
        throw new Error('自动清除时间需在 1 到 300 秒之间')
      }
      return currentSettings(await updateAppConfig({ secretClearSeconds: Math.round(seconds) }))
    }
  )

  ipcMain.handle(
    'settings:set-launch-at-login',
    async (_event, enabled: boolean): Promise<AppSettings> => {
      app.setLoginItemSettings({ openAtLogin: Boolean(enabled), args: ['--hidden'] })
      return currentSettings(await readAppConfig())
    }
  )

  ipcMain.handle(
    'settings:set-backup-reminder',
    async (_event, enabled: boolean, time: string): Promise<AppSettings> => {
      if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('提醒时间格式应为 HH:mm')
      return currentSettings(
        await updateAppConfig({
          backupReminderEnabled: Boolean(enabled),
          backupReminderTime: time
        })
      )
    }
  )

  ipcMain.handle(
    'settings:set-update-preference',
    async (_event, enabled: boolean, source: UpdateSource): Promise<AppSettings> => {
      if (source !== 'auto' && source !== 'github' && source !== 'gitee') {
        throw new Error(`非法的更新源：${source}`)
      }
      invalidateUpdateCache()
      return currentSettings(
        await updateAppConfig({ updateCheckEnabled: Boolean(enabled), updateSource: source })
      )
    }
  )

  ipcMain.handle('update:bootstrap', () => bootstrapUpdate())

  ipcMain.handle('update:check', (_event, manual?: boolean) => checkForUpdate(Boolean(manual)))

  ipcMain.handle('update:dismiss', async (_event, version: string): Promise<void> => {
    if (!/^\d+\.\d+\.\d+/.test(version)) throw new Error(`非法的版本号：${version}`)
    await dismissVersion(version)
  })

  ipcMain.handle('update:open', async (_event, url: string): Promise<void> => {
    await openUpdateUrl(url)
  })

  ipcMain.handle('clipboard:write', async (_event, text: string): Promise<void> => {
    await clipboard.writeText(text)
  })

  ipcMain.handle('search:query', async (_event, text: string, limit?: number) => {
    const vaultPath = await requireVault()
    return searchVault(vaultPath, text, limit ?? 60)
  })

  ipcMain.handle('capture:submit', async (_event, text: string): Promise<void> => {
    const content = text.trim()
    if (!content) return

    const vaultPath = await requireVault()
    const today = formatDateKey(new Date())
    const month = monthKeyForDate(today)
    const raw = await readMonthRaw(vaultPath, month)
    const next = appendEntry(
      raw,
      month,
      today,
      serializeEntry({ time: formatTimeHm(new Date()), content })
    )

    await writeMonthRaw(vaultPath, month, next)
    getWindow()?.webContents.send('data:changed')
    closeCapture()
  })

  ipcMain.handle('capture:close', async (): Promise<void> => {
    closeCapture()
  })

  ipcMain.handle('capture:resize', async (_event, height: number): Promise<void> => {
    resizeCapture(height)
  })

  ipcMain.handle('daily:tags', async (): Promise<string[]> => {
    const vaultPath = await requireVault()
    return listTags(vaultPath)
  })

  ipcMain.handle('security:status', async (): Promise<SecurityStatus> => {
    const vaultPath = await requireVault()
    return { configured: await isConfigured(vaultPath), unlocked: isUnlocked(vaultPath) }
  })

  ipcMain.handle('security:setup', async (_event, password: string): Promise<SecurityStatus> => {
    const vaultPath = await requireVault()
    await setupPassword(vaultPath, password)
    return { configured: true, unlocked: true }
  })

  ipcMain.handle('security:unlock', async (_event, password: string): Promise<SecurityStatus> => {
    const vaultPath = await requireVault()
    const ok = await unlockSession(vaultPath, password)
    if (!ok) throw new Error('主密码不正确')
    return { configured: true, unlocked: true }
  })

  ipcMain.handle('security:lock', async (): Promise<SecurityStatus> => {
    lockSession()
    const vaultPath = await requireVault()
    return { configured: await isConfigured(vaultPath), unlocked: false }
  })

  ipcMain.handle('assets:list', async (_event, project: string): Promise<Asset[]> => {
    const vaultPath = await requireVault()
    return listAssets(vaultPath, project)
  })

  ipcMain.handle(
    'assets:save',
    async (_event, project: string, asset: Asset): Promise<Asset[]> => {
      const vaultPath = await requireVault()
      return saveAsset(vaultPath, project, asset)
    }
  )

  ipcMain.handle(
    'assets:remove',
    async (_event, project: string, id: string): Promise<Asset[]> => {
      const vaultPath = await requireVault()
      return removeAsset(vaultPath, project, id)
    }
  )

  ipcMain.handle('assets:copy', async (_event, text: string): Promise<void> => {
    await clipboard.writeText(text)

    const config = await readAppConfig()
    const seconds = Math.max(1, config.secretClearSeconds)
    if (clipboardClearTimer) clearTimeout(clipboardClearTimer)

    clipboardClearTimer = setTimeout(() => {
      clipboardClearTimer = null
      // 只有剪贴板内容仍是这条记录时才清空，避免覆盖用户后来复制的东西
      void clipboard.readText().then((current) => {
        if (current === text) clipboard.clear()
      })
    }, seconds * 1000)
  })

  ipcMain.handle(
    'stats:range',
    async (_event, start: string, end: string): Promise<StatsReport> => {
      assertDate(start)
      assertDate(end)
      if (start > end) throw new Error('时间范围不合法')

      const vaultPath = await requireVault()
      const docs = []
      const completed: CompletedTodo[] = []

      for (const month of monthsBetween(start, end)) {
        docs.push(parseMonth(month, await readMonthRaw(vaultPath, month)))
        for (const item of await listArchive(vaultPath, month)) {
          if (!item.doneDate || item.doneDate < start || item.doneDate > end) continue
          completed.push({
            content: item.content,
            doneDate: item.doneDate,
            project: item.project
          })
        }
      }

      completed.sort((a, b) => b.doneDate.localeCompare(a.doneDate))
      return { ...computeStats(docs, start, end), completed }
    }
  )
}
