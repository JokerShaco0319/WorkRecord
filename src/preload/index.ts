import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { WorkRecordApi } from '@shared/api'

const api: WorkRecordApi = {
  vault: {
    get: () => ipcRenderer.invoke('vault:get'),
    choose: () => ipcRenderer.invoke('vault:choose')
  },
  daily: {
    read: (date) => ipcRenderer.invoke('daily:read', date),
    appendEntry: (date, entry) => ipcRenderer.invoke('daily:append-entry', date, entry),
    updateEntry: (date, target, entry) =>
      ipcRenderer.invoke('daily:update-entry', date, target, entry),
    removeEntry: (date, target) => ipcRenderer.invoke('daily:remove-entry', date, target),
    readMonth: (month) => ipcRenderer.invoke('daily:read-month', month),
    saveMonth: (month, raw) => ipcRenderer.invoke('daily:save-month', month, raw)
  },
  todo: {
    read: () => ipcRenderer.invoke('todo:read'),
    add: (quadrant, input) => ipcRenderer.invoke('todo:add', quadrant, input),
    update: (target, input) => ipcRenderer.invoke('todo:update', target, input),
    remove: (target) => ipcRenderer.invoke('todo:remove', target),
    move: (target, quadrant) => ipcRenderer.invoke('todo:move', target, quadrant),
    toggle: (target) => ipcRenderer.invoke('todo:toggle', target)
  },
  projects: {
    list: () => ipcRenderer.invoke('projects:list'),
    create: (name) => ipcRenderer.invoke('projects:create', name),
    read: (name) => ipcRenderer.invoke('projects:read', name),
    addCategory: (name, category) => ipcRenderer.invoke('projects:add-category', name, category),
    reveal: (name) => ipcRenderer.invoke('projects:reveal', name)
  },
  weekly: {
    preview: (week) => ipcRenderer.invoke('weekly:preview', week),
    read: (week) => ipcRenderer.invoke('weekly:read', week),
    generate: (week) => ipcRenderer.invoke('weekly:generate', week),
    save: (week, raw) => ipcRenderer.invoke('weekly:save', week, raw)
  },
  files: {
    import: (project, category) => ipcRenderer.invoke('files:import', project, category),
    importPaths: (project, category, paths) =>
      ipcRenderer.invoke('files:import-paths', project, category, paths),
    open: (project, category, name) => ipcRenderer.invoke('files:open', project, category, name),
    reveal: (project, category, name) =>
      ipcRenderer.invoke('files:reveal', project, category, name),
    trash: (project, category, name) => ipcRenderer.invoke('files:trash', project, category, name),
    pathOf: (file) => webUtils.getPathForFile(file)
  },
  search: {
    query: (text, limit) => ipcRenderer.invoke('search:query', text, limit)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    setTheme: (theme) => ipcRenderer.invoke('settings:set-theme', theme)
  },
  capture: {
    submit: (text) => ipcRenderer.invoke('capture:submit', text),
    close: () => ipcRenderer.invoke('capture:close')
  },
  events: {
    onDataChanged: (listener) => {
      const handler = (): void => listener()
      ipcRenderer.on('data:changed', handler)
      return () => {
        ipcRenderer.removeListener('data:changed', handler)
      }
    }
  }
}

contextBridge.exposeInMainWorld('api', api)
