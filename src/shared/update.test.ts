import { describe, expect, it } from 'vitest'
import {
  compareVersions,
  isAllowedDownloadUrl,
  parseManifest,
  parseVersion
} from './update'
import { notesBetween } from './changelog'

describe('版本号', () => {
  it('解析标准版本号与 v 前缀', () => {
    expect(parseVersion('0.2.0')?.numbers).toEqual([0, 2, 0])
    expect(parseVersion('v1.10.3')?.numbers).toEqual([1, 10, 3])
    expect(parseVersion('1.0')).toBeNull()
    expect(parseVersion('abc')).toBeNull()
  })

  it('按数字比较而不是字符串比较', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', 'v1.0.0')).toBe(0)
    expect(compareVersions('0.2.0', '0.2.1')).toBeLessThan(0)
  })

  it('预发布版本低于正式版本', () => {
    expect(compareVersions('1.0.0-beta', '1.0.0')).toBeLessThan(0)
    expect(compareVersions('1.0.0-beta.2', '1.0.0-beta.1')).toBeGreaterThan(0)
  })
})

describe('更新清单', () => {
  it('只保留结构正确的字段', () => {
    const manifest = parseManifest({
      version: '0.3.0',
      date: '2026-12-01',
      notes: '### 新增\n- 测试',
      downloads: {
        github: 'https://github.com/owner/repo/releases/download/v0.3.0/a.exe',
        bad: 'http://example.com/a.exe'
      },
      extra: 'ignored'
    })

    expect(manifest).toEqual({
      version: '0.3.0',
      date: '2026-12-01',
      notes: '### 新增\n- 测试',
      downloads: {
        github: 'https://github.com/owner/repo/releases/download/v0.3.0/a.exe'
      }
    })
  })

  it('拒绝非法版本号与错误结构', () => {
    expect(parseManifest(null)).toBeNull()
    expect(parseManifest({ version: 'latest' })).toBeNull()
    expect(parseManifest({ version: '1.0.0', downloads: 'x' })).toEqual({
      version: '1.0.0',
      date: undefined,
      notes: undefined,
      downloads: undefined
    })
  })

  it('只接受 https 的可信域名', () => {
    expect(isAllowedDownloadUrl('https://github.com/a/b')).toBe(true)
    expect(isAllowedDownloadUrl('https://gitcode.com/a/b')).toBe(true)
    expect(isAllowedDownloadUrl('https://file-cdn.gitcode.com/a/b.exe')).toBe(true)
    expect(isAllowedDownloadUrl('https://gitee.com/a/b')).toBe(true)
    expect(isAllowedDownloadUrl('http://github.com/a/b')).toBe(false)
    expect(isAllowedDownloadUrl('https://evil.example.com/a.exe')).toBe(false)
    expect(isAllowedDownloadUrl('https://notgitcode.com/a.exe')).toBe(false)
    expect(isAllowedDownloadUrl('not a url')).toBe(false)
  })
})

describe('更新说明', () => {
  it('取指定版本区间内的说明', () => {
    expect(notesBetween('0.0.0', '0.2.0').map((note) => note.version)).toEqual(['0.2.0'])
    expect(notesBetween('0.2.0', '0.2.0')).toEqual([])
  })
})
