import { join } from 'node:path'

export interface DataPathOptions {
  env: NodeJS.ProcessEnv
  isPackaged: boolean
  appData: string
  localAppData: string
}

export interface DataPaths {
  userData: string
  sessionData: string
  updates: string
  crashDumps: string
}

/**
 * 安装版把配置放在 %APPDATA%，缓存/更新包放在 %LOCALAPPDATA%，避免应用更新或卸载时丢失；
 * 便携版继续使用 exe 旁的 data 目录，保持便携性；开发态沿用系统默认位置。
 */
export function resolveDataPaths(options: DataPathOptions): DataPaths | null {
  const override = options.env.WORKRECORD_USER_DATA
  if (override) {
    return {
      userData: override,
      sessionData: override,
      updates: join(override, 'updates'),
      crashDumps: join(override, 'crash')
    }
  }

  const portable = options.env.PORTABLE_EXECUTABLE_DIR
  if (portable) {
    const dir = join(portable, 'data')
    return {
      userData: dir,
      sessionData: dir,
      updates: join(dir, 'updates'),
      crashDumps: join(dir, 'crash')
    }
  }

  if (!options.isPackaged) return null

  const userData = join(options.appData, 'WorkRecord')
  const local = join(options.localAppData, 'WorkRecord')
  return {
    userData,
    sessionData: join(local, 'session'),
    updates: join(local, 'updates'),
    crashDumps: join(local, 'crash')
  }
}
