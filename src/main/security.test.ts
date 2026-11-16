import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assetsPath, listAssets, removeAsset, saveAsset } from './assets'
import { isConfigured, isUnlocked, lockSession, setupPassword, unlockSession } from './security'

let vault: string

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'workrecord-sec-'))
  await mkdir(join(vault, 'projects', '项目A'), { recursive: true })
  lockSession()
})

afterEach(async () => {
  lockSession()
  await rm(vault, { recursive: true, force: true })
})

describe('主密码', () => {
  it('设置后即解锁，错误密码无法解锁', async () => {
    expect(await isConfigured(vault)).toBe(false)

    await setupPassword(vault, 'secret123')
    expect(await isConfigured(vault)).toBe(true)
    expect(isUnlocked(vault)).toBe(true)

    lockSession()
    expect(await unlockSession(vault, 'wrong-pass')).toBe(false)
    expect(isUnlocked(vault)).toBe(false)

    expect(await unlockSession(vault, 'secret123')).toBe(true)
  })

  it('拒绝过短密码与重复设置', async () => {
    await expect(setupPassword(vault, '123')).rejects.toThrow()
    await setupPassword(vault, 'secret123')
    await expect(setupPassword(vault, 'another123')).rejects.toThrow()
  })

  it('锁定后不能读取资产', async () => {
    await setupPassword(vault, 'secret123')
    lockSession()
    await expect(listAssets(vault, '项目A')).rejects.toThrow()
  })

  it('不同数据目录的会话互不通用', async () => {
    const other = await mkdtemp(join(tmpdir(), 'workrecord-sec-other-'))
    await setupPassword(vault, 'secret123')
    expect(isUnlocked(other)).toBe(false)
    await rm(other, { recursive: true, force: true })
  })
})

describe('加密资产', () => {
  it('保存与读取', async () => {
    await setupPassword(vault, 'secret123')

    const items = await saveAsset(vault, '项目A', {
      id: '',
      title: '服务器',
      notes: '',
      updatedAt: '',
      fields: [{ id: '', label: '密码', value: 'p@ss', secret: true }]
    })

    expect(items).toHaveLength(1)
    expect(items[0].title).toBe('服务器')
    expect(items[0].id).not.toBe('')
    expect(items[0].fields[0].id).not.toBe('')

    const listed = await listAssets(vault, '项目A')
    expect(listed[0].fields[0].value).toBe('p@ss')
  })

  it('落盘内容是密文', async () => {
    await setupPassword(vault, 'secret123')
    await saveAsset(vault, '项目A', {
      id: '',
      title: '服务器',
      notes: 'root 账号备注',
      updatedAt: '',
      fields: [{ id: '', label: '密码', value: 'p@ssw0rd', secret: true }]
    })

    const raw = await readFile(assetsPath(vault, '项目A'), 'utf-8')
    expect(raw).not.toContain('p@ssw0rd')
    expect(raw).not.toContain('服务器')
    expect(raw).not.toContain('root 账号备注')
  })

  it('更新与删除', async () => {
    await setupPassword(vault, 'secret123')
    const created = await saveAsset(vault, '项目A', {
      id: '',
      title: 'A',
      notes: '',
      updatedAt: '',
      fields: []
    })

    await saveAsset(vault, '项目A', { ...created[0], title: 'A2' })
    expect((await listAssets(vault, '项目A'))[0].title).toBe('A2')

    const left = await removeAsset(vault, '项目A', created[0].id)
    expect(left).toHaveLength(0)
  })

  it('未设置主密码时读取会报错', async () => {
    await expect(listAssets(vault, '项目A')).rejects.toThrow()
  })
})
