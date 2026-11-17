import type { DayDoc, EntryInput, EntryTarget } from './md/month'
import type { ProjectStatus } from './md/project'
import type { Quadrant, TodoDoc, TodoInput, TodoTarget } from './md/todo'
import type { ArchiveItem, ArchiveTarget } from './md/todoArchive'

export interface VaultInfo {
  path: string | null
}

export interface MonthFile {
  month: string
  raw: string
}

export interface ProjectFileInfo {
  category: string
  /** 相对分类目录的路径，使用 / 分隔，例如「草图/a.png」 */
  path: string
  name: string
  size: number
  modified: string
}

export interface ProjectFolderInfo {
  category: string
  /** 相对分类目录的路径，例如「草图」 */
  path: string
}

export interface ProjectSummary {
  name: string
  description: string
  categories: string[]
  status: ProjectStatus
  fileCount: number
  updatedAt: string | null
}

export interface BackupInfo {
  date: string
  files: number
}

export interface ProjectDetail extends ProjectSummary {
  files: ProjectFileInfo[]
  folders: ProjectFolderInfo[]
}

export interface WeeklyPreview {
  week: string
  start: string
  end: string
  title: string
  body: string
  entryCount: number
  projectCount: number
}

export type SearchHit =
  | { kind: 'entry'; date: string; time: string | null; project: string | null; content: string }
  | { kind: 'todo'; quadrant: Quadrant; content: string; done: boolean }
  | { kind: 'weekly'; week: string; text: string }
  | { kind: 'project-file'; project: string; category: string; name: string }

export interface AppSettings {
  theme: 'light' | 'dark'
  secretClearSeconds: number
  launchAtLogin: boolean
  backupReminderEnabled: boolean
  backupReminderTime: string
}

export interface AssetField {
  id: string
  label: string
  value: string
  secret: boolean
}

export interface Asset {
  id: string
  title: string
  fields: AssetField[]
  notes: string
  updatedAt: string
}

export interface SecurityStatus {
  configured: boolean
  unlocked: boolean
}

export interface ProjectStat {
  project: string
  minutes: number
  count: number
}

export interface DayStat {
  date: string
  minutes: number
}

export interface CompletedTodo {
  content: string
  doneDate: string
  project: string | null
}

export interface StatsReport {
  start: string
  end: string
  totalMinutes: number
  entryCount: number
  untimedCount: number
  projects: ProjectStat[]
  days: DayStat[]
  completed: CompletedTodo[]
}

export interface WorkRecordApi {
  vault: {
    get(): Promise<VaultInfo>
    choose(): Promise<VaultInfo>
    reveal(): Promise<void>
  }
  daily: {
    read(date: string): Promise<DayDoc>
    appendEntry(date: string, entry: EntryInput): Promise<DayDoc>
    updateEntry(date: string, target: EntryTarget, entry: EntryInput): Promise<DayDoc>
    removeEntry(date: string, target: EntryTarget): Promise<DayDoc>
    readMonth(month: string): Promise<MonthFile>
    saveMonth(month: string, raw: string): Promise<MonthFile>
    tags(): Promise<string[]>
  }
  todo: {
    read(): Promise<TodoDoc>
    add(quadrant: Quadrant, input: TodoInput): Promise<TodoDoc>
    update(target: TodoTarget, input: TodoInput): Promise<TodoDoc>
    remove(target: TodoTarget): Promise<TodoDoc>
    move(target: TodoTarget, quadrant: Quadrant): Promise<TodoDoc>
    toggle(target: TodoTarget): Promise<TodoDoc>
    archive(month: string): Promise<ArchiveItem[]>
    restore(month: string, target: ArchiveTarget): Promise<ArchiveItem[]>
  }
  projects: {
    list(): Promise<ProjectSummary[]>
    create(name: string): Promise<ProjectDetail>
    read(name: string): Promise<ProjectDetail>
    addCategory(name: string, category: string): Promise<ProjectDetail>
    setStatus(name: string, status: ProjectStatus): Promise<ProjectDetail>
    reveal(name: string): Promise<void>
  }
  weekly: {
    preview(week: string): Promise<WeeklyPreview>
    read(week: string): Promise<string | null>
    generate(week: string): Promise<string>
    save(week: string, raw: string): Promise<string>
    export(week: string, text: string): Promise<boolean>
  }
  files: {
    import(project: string, category: string, dir: string): Promise<ProjectDetail | null>
    importPaths(
      project: string,
      category: string,
      dir: string,
      paths: string[]
    ): Promise<ProjectDetail>
    open(project: string, category: string, path: string): Promise<void>
    reveal(project: string, category: string, path: string): Promise<void>
    trash(project: string, category: string, path: string): Promise<ProjectDetail>
    rename(
      project: string,
      category: string,
      path: string,
      newName: string
    ): Promise<ProjectDetail>
    move(
      project: string,
      category: string,
      path: string,
      toCategory: string
    ): Promise<ProjectDetail>
    createFolder(
      project: string,
      category: string,
      dir: string,
      name: string
    ): Promise<ProjectDetail>
    pathOf(file: File): string
  }
  backups: {
    list(): Promise<BackupInfo[]>
    create(): Promise<number>
    restore(date: string): Promise<number>
  }
  search: {
    query(text: string, limit?: number): Promise<SearchHit[]>
  }
  settings: {
    get(): Promise<AppSettings>
    setTheme(theme: 'light' | 'dark'): Promise<AppSettings>
    setSecretClearSeconds(seconds: number): Promise<AppSettings>
    setLaunchAtLogin(enabled: boolean): Promise<AppSettings>
    setBackupReminder(enabled: boolean, time: string): Promise<AppSettings>
  }
  clipboard: {
    write(text: string): Promise<void>
  }
  capture: {
    submit(text: string): Promise<void>
    close(): Promise<void>
    resize(height: number): Promise<void>
    onReset(listener: () => void): () => void
  }
  events: {
    onDataChanged(listener: () => void): () => void
  }
  security: {
    status(): Promise<SecurityStatus>
    setup(password: string): Promise<SecurityStatus>
    unlock(password: string): Promise<SecurityStatus>
    lock(): Promise<SecurityStatus>
  }
  assets: {
    list(project: string): Promise<Asset[]>
    save(project: string, asset: Asset): Promise<Asset[]>
    remove(project: string, id: string): Promise<Asset[]>
    copy(text: string): Promise<void>
  }
  stats: {
    range(start: string, end: string): Promise<StatsReport>
  }
}
