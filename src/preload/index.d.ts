import type { WorkRecordApi } from '../shared/api'

declare global {
  interface Window {
    api: WorkRecordApi
  }
}

export {}
