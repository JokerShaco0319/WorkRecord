import type { DayDoc, EntryInput, EntryTarget } from './md/month'
import type { Quadrant, TodoDoc, TodoInput, TodoTarget } from './md/todo'

export interface VaultInfo {
  path: string | null
}

export interface MonthFile {
  month: string
  raw: string
}

export interface ProjectFileInfo {
  category: string
  name: string
  size: number
  modified: string
}

export interface ProjectSummary {
  name: string
  description: string
  categories: string[]
  fileCount: number
  updatedAt: string | null
}

export interface ProjectDetail extends ProjectSummary {
  files: ProjectFileInfo[]
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
}

export interface WorkRecordApi {
  vault: {
    get(): Promise<VaultInfo>
    choose(): Promise<VaultInfo>
  }
  daily: {
    read(date: string): Promise<DayDoc>
    appendEntry(date: string, entry: EntryInput): Promise<DayDoc>
    updateEntry(date: string, target: EntryTarget, entry: EntryInput): Promise<DayDoc>
    removeEntry(date: string, target: EntryTarget): Promise<DayDoc>
    readMonth(month: string): Promise<MonthFile>
    saveMonth(month: string, raw: string): Promise<MonthFile>
  }
  todo: {
    read(): Promise<TodoDoc>
    add(quadrant: Quadrant, input: TodoInput): Promise<TodoDoc>
    update(target: TodoTarget, input: TodoInput): Promise<TodoDoc>
    remove(target: TodoTarget): Promise<TodoDoc>
    move(target: TodoTarget, quadrant: Quadrant): Promise<TodoDoc>
    toggle(target: TodoTarget): Promise<TodoDoc>
  }
  projects: {
    list(): Promise<ProjectSummary[]>
    create(name: string): Promise<ProjectDetail>
    read(name: string): Promise<ProjectDetail>
    addCategory(name: string, category: string): Promise<ProjectDetail>
    reveal(name: string): Promise<void>
  }
  weekly: {
    preview(week: string): Promise<WeeklyPreview>
    read(week: string): Promise<string | null>
    generate(week: string): Promise<string>
    save(week: string, raw: string): Promise<string>
  }
  files: {
    import(project: string, category: string): Promise<ProjectDetail | null>
    importPaths(project: string, category: string, paths: string[]): Promise<ProjectDetail>
    open(project: string, category: string, name: string): Promise<void>
    reveal(project: string, category: string, name: string): Promise<void>
    trash(project: string, category: string, name: string): Promise<ProjectDetail>
    pathOf(file: File): string
  }
  search: {
    query(text: string, limit?: number): Promise<SearchHit[]>
  }
  settings: {
    get(): Promise<AppSettings>
    setTheme(theme: 'light' | 'dark'): Promise<AppSettings>
  }
  capture: {
    submit(text: string): Promise<void>
    close(): Promise<void>
  }
  events: {
    onDataChanged(listener: () => void): () => void
  }
}
