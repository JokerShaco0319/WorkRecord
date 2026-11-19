import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { resolveDataPaths } from './dataPaths'

const base = {
  isPackaged: true,
  appData: 'C:\\Users\\test\\AppData\\Roaming',
  localAppData: 'C:\\Users\\test\\AppData\\Local'
}

describe('数据目录', () => {
  it('安装版：配置和会话分离到 Roaming / Local', () => {
    const paths = resolveDataPaths({ ...base, env: {} })
    expect(paths).toEqual({
      userData: join(base.appData, 'WorkRecord'),
      sessionData: join(base.localAppData, 'WorkRecord', 'session'),
      updates: join(base.localAppData, 'WorkRecord', 'updates'),
      crashDumps: join(base.localAppData, 'WorkRecord', 'crash')
    })
  })

  it('便携版：全部放在 exe 旁的 data 目录', () => {
    const paths = resolveDataPaths({
      ...base,
      env: { PORTABLE_EXECUTABLE_DIR: 'D:\\Apps\\WorkRecord' }
    })
    expect(paths?.userData).toBe(join('D:\\Apps\\WorkRecord', 'data'))
    expect(paths?.sessionData).toBe(join('D:\\Apps\\WorkRecord', 'data'))
    expect(paths?.updates).toBe(join('D:\\Apps\\WorkRecord', 'data', 'updates'))
  })

  it('测试覆盖优先于便携版与安装版', () => {
    const paths = resolveDataPaths({
      ...base,
      env: { WORKRECORD_USER_DATA: 'D:\\temp\\data', PORTABLE_EXECUTABLE_DIR: 'D:\\Apps' }
    })
    expect(paths?.userData).toBe('D:\\temp\\data')
  })

  it('开发态沿用默认位置', () => {
    expect(resolveDataPaths({ ...base, isPackaged: false, env: {} })).toBeNull()
  })
})
