import { describe, expect, it } from 'vitest'
import { parseProject, projectTemplate, setStatusInRaw } from './project'

describe('项目状态', () => {
  it('新建模板默认为进行中', () => {
    expect(parseProject(projectTemplate('项目A', '2026-11-16')).meta.status).toBe('active')
  })

  it('读取状态，非法值回落为进行中', () => {
    const raw = [
      '---',
      'created: 2026-11-01',
      'status: archived',
      'categories:',
      '  - 需求',
      '---',
      '',
      '# 项目A'
    ].join('\n')

    expect(parseProject(raw).meta.status).toBe('archived')
    expect(parseProject(raw.replace('archived', 'weird')).meta.status).toBe('active')
  })

  it('修改状态时保留其它字段', () => {
    const next = setStatusInRaw(projectTemplate('项目A', '2026-11-16'), 'paused')

    expect(next).toContain('status: paused')
    expect(next).toContain('created: 2026-11-16')
    expect(next).toContain('  - 需求')
  })

  it('缺少 status 时补上', () => {
    const raw = ['---', 'created: 2026-11-01', '---', '', '# 项目A'].join('\n')
    expect(setStatusInRaw(raw, 'archived')).toContain('status: archived')
  })
})
