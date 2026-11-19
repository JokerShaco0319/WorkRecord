import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { WorkRecordApi } from '@shared/api'
import type { UpdateProgress } from '@shared/update'

const api: WorkRecordApi = {
  vault: {
    get: () => ipcRenderer.invoke('vault:get'),
    choose: () => ipcRenderer.invoke('vault:choose'),
    reveal: () => ipcRenderer.invoke('vault:reveal')
  },
  daily: {
    read: (date) => ipcRenderer.invoke('daily:read', date),
    appendEntry: (date, entry) => ipcRenderer.invoke('daily:append-entry', date, entry),
    updateEntry: (date, target, entry) =>
      ipcRenderer.invoke('daily:update-entry', date, target, entry),
    removeEntry: (date, target) => ipcRenderer.invoke('daily:remove-entry', date, target),
    readMonth: (month) => ipcRenderer.invoke('daily:read-month', month),
    saveMonth: (month, raw) => ipcRenderer.invoke('daily:save-month', month, raw),
    tags: () => ipcRenderer.invoke('daily:tags')
  },
  todo: {
    read: () => ipcRenderer.invoke('todo:read'),
    add: (quadrant, input) => ipcRenderer.invoke('todo:add', quadrant, input),
    update: (target, input) => ipcRenderer.invoke('todo:update', target, input),
    remove: (target) => ipcRenderer.invoke('todo:remove', target),
    move: (target, quadrant) => ipcRenderer.invoke('todo:move', target, quadrant),
    toggle: (target) => ipcRenderer.invoke('todo:toggle', target),
    archive: (month) => ipcRenderer.invoke('todo:archive', month),
    restore: (month, target) => ipcRenderer.invoke('todo:restore', month, target)
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    create: (name) => ipcRenderer.invoke('projects:create', name),
    read: (name) => ipcRenderer.invoke('projects:read', name),
    addCategory: (name, category) => ipcRenderer.invoke('projects:add-category', name, category),
    setStatus: (name, status) => ipcRenderer.invoke('projects:set-status', name, status),
    reveal: (name) => ipcRenderer.invoke('projects:reveal', name)
  },
  weekly: {
    preview: (week) => ipcRenderer.invoke('weekly:preview', week),
    read: (week) => ipcRenderer.invoke('weekly:read', week),
    generate: (week) => ipcRenderer.invoke('weekly:generate', week),
    save: (week, raw) => ipcRenderer.invoke('weekly:save', week, raw),
    export: (week, text) => ipcRenderer.invoke('weekly:export', week, text)
  },
  files: {
    import: (project, category, dir) => ipcRenderer.invoke('files:import', project, category, dir),
    importPaths: (project, category, dir, paths) =>
      ipcRenderer.invoke('files:import-paths', project, category, dir, paths),
    open: (project, category, path) => ipcRenderer.invoke('files:open', project, category, path),
    reveal: (project, category, path) =>
      ipcRenderer.invoke('files:reveal', project, category, path),
    trash: (project, category, path) => ipcRenderer.invoke('files:trash', project, category, path),
    rename: (project, category, path, newName) =>
      ipcRenderer.invoke('files:rename', project, category, path, newName),
    renameFolder: (project, category, path, newName) =>
      ipcRenderer.invoke('files:rename-folder', project, category, path, newName),
    move: (project, category, path, toCategory) =>
      ipcRenderer.invoke('files:move', project, category, path, toCategory),
    createFolder: (project, category, dir, name) =>
      ipcRenderer.invoke('files:create-folder', project, category, dir, name),
    pathOf: (file) => webUtils.getPathForFile(file)
  },
  backups: {
    list: () => ipcRenderer.invoke('backups:list'),
    create: () => ipcRenderer.invoke('backups:create'),
    restore: (date) => ipcRenderer.invoke('backups:restore', date)
  },
  search: {
    query: (text, limit) => ipcRenderer.invoke('search:query', text, limit)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    setTheme: (theme) => ipcRenderer.invoke('settings:set-theme', theme),
    setSecretClearSeconds: (seconds) =>
      ipcRenderer.invoke('settings:set-secret-clear-seconds', seconds),
    setLaunchAtLogin: (enabled) =>
      ipcRenderer.invoke('settings:set-launch-at-login', enabled),
    setBackupReminder: (enabled, time) =>
      ipcRenderer.invoke('settings:set-backup-reminder', enabled, time),
    setUpdatePreference: (enabled, source) =>
      ipcRenderer.invoke('settings:set-update-preference', enabled, source)
  },
  update: {
    bootstrap: () => ipcRenderer.invoke('update:bootstrap'),
    check: (manual) => ipcRenderer.invoke('update:check', Boolean(manual)),
    dismiss: (version) => ipcRenderer.invoke('update:dismiss', version),
    open: (url) => ipcRenderer.invoke('update:open', url),
    download: (url, sha256) => ipcRenderer.invoke('update:download', url, sha256),
    install: (filePath) => ipcRenderer.invoke('update:install', filePath),
    cancel: () => ipcRenderer.invoke('update:cancel'),
    onProgress: (listener) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: UpdateProgress): void =>
        listener(progress)
      ipcRenderer.on('update:progress', handler)
      return () => {
        ipcRenderer.removeListener('update:progress', handler)
      }
    }
  },
  shortcut: {
    createStartMenu: () => ipcRenderer.invoke('shortcut:create-start-menu')
  },
  clipboard: {
    write: (text) => ipcRenderer.invoke('clipboard:write', text)
  },
  capture: {
    submit: (text) => ipcRenderer.invoke('capture:submit', text),
    close: () => ipcRenderer.invoke('capture:close'),
    resize: (height) => ipcRenderer.invoke('capture:resize', height),
    onReset: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on('capture:reset', handler)
      return () => {
        ipcRenderer.removeListener('capture:reset', handler)
      }
    }
  },
  events: {
    onDataChanged: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on('data:changed', handler)
      return () => {
        ipcRenderer.removeListener('data:changed', handler)
      }
    }
  },
  security: {
    status: () => ipcRenderer.invoke('security:status'),
    setup: (password) => ipcRenderer.invoke('security:setup', password),
    unlock: (password) => ipcRenderer.invoke('security:unlock', password),
    lock: () => ipcRenderer.invoke('security:lock')
  },
  assets: {
    list: (project) => ipcRenderer.invoke('assets:list', project),
    save: (project, asset) => ipcRenderer.invoke('assets:save', project, asset),
    remove: (project, id) => ipcRenderer.invoke('assets:remove', project, id),
    copy: (text) => ipcRenderer.invoke('assets:copy', text)
  },
  stats: {
    range: (start, end) => ipcRenderer.invoke('stats:range', start, end)
  }
}

contextBridge.exposeInMainWorld('api', api)
