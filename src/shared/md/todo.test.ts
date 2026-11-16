import { describe, expect, it } from 'vitest'
import {
  addTodo,
  moveTodo,
  parseTodo,
  removeTodo,
  serializeTodoItem,
  todoTemplate,
  toggleTodo,
  updateTodo
} from './todo'

describe('todoTemplate / parseTodo', () => {
  it('模板包含四个象限且没有条目', () => {
    const doc = parseTodo(todoTemplate())
    expect(doc.items).toEqual([])
  })

  it('解析条目及其元数据', () => {
    const raw = [
      '# 待办清单',
      '',
      '## 重要且紧急',
      '- [ ] 修复支付回调超时 | due:2026-11-18 | proj:项目A',
      '- [x] 完成登录联调 | done:2026-11-15 | proj:项目A',
      '',
      '## 重要但不紧急',
      '- 梳理接口文档 | proj:项目B'
    ].join('\n')

    const doc = parseTodo(raw)
    expect(doc.items).toHaveLength(3)
    expect(doc.items[0]).toMatchObject({
      content: '修复支付回调超时',
      quadrant: 'q1',
      due: '2026-11-18',
      project: '项目A',
      done: false
    })
    expect(doc.items[1]).toMatchObject({ done: true, doneDate: '2026-11-15' })
    expect(doc.items[2]).toMatchObject({
      content: '梳理接口文档',
      quadrant: 'q2',
      due: null,
      project: '项目B'
    })
  })

  it('内容里的竖线不会被当成元数据', () => {
    const doc = parseTodo(['## 重要且紧急', '- [ ] A | B'].join('\n'))
    expect(doc.items[0].content).toBe('A | B')
  })

  it('忽略代码块中的列表', () => {
    const raw = ['## 重要且紧急', '- [ ] 真实待办', '```', '- [ ] 示例', '```'].join('\n')
    expect(parseTodo(raw).items).toHaveLength(1)
  })
})

describe('serializeTodoItem', () => {
  it('按统一格式输出', () => {
    expect(serializeTodoItem('修复支付回调', { due: '2026-11-18', project: '项目A' })).toBe(
      '- [ ] 修复支付回调 | due:2026-11-18 | proj:项目A'
    )
  })

  it('已完成条目带上完成日期', () => {
    expect(
      serializeTodoItem('完成联调', { done: true, doneDate: '2026-11-15', project: '项目A' })
    ).toBe('- [x] 完成联调 | done:2026-11-15 | proj:项目A')
  })
})

describe('增删改', () => {
  it('新增到指定象限末尾', () => {
    let raw = todoTemplate()
    raw = addTodo(raw, 'q1', { content: '修复支付回调', due: '2026-11-18' })
    raw = addTodo(raw, 'q1', { content: '提交季度总结' })

    const items = parseTodo(raw).items
    expect(items.map((item) => item.content)).toEqual(['修复支付回调', '提交季度总结'])
    expect(items.every((item) => item.quadrant === 'q1')).toBe(true)
  })

  it('修改条目保留其他字段', () => {
    let raw = todoTemplate()
    raw = addTodo(raw, 'q2', { content: '梳理文档', due: '2026-11-20', project: '项目B' })
    const item = parseTodo(raw).items[0]

    raw = updateTodo(raw, item, { content: '梳理接口文档', due: '2026-11-21', project: '项目B' })

    expect(parseTodo(raw).items[0]).toMatchObject({
      content: '梳理接口文档',
      due: '2026-11-21',
      project: '项目B',
      quadrant: 'q2'
    })
  })

  it('删除条目', () => {
    let raw = todoTemplate()
    raw = addTodo(raw, 'q3', { content: '回复邮件' })
    const item = parseTodo(raw).items[0]

    raw = removeTodo(raw, item)
    expect(parseTodo(raw).items).toEqual([])
  })

  it('跨象限移动', () => {
    let raw = todoTemplate()
    raw = addTodo(raw, 'q1', { content: '回复邮件' })
    raw = addTodo(raw, 'q1', { content: '修复支付回调' })
    const first = parseTodo(raw).items[0]

    raw = moveTodo(raw, first, 'q3')

    const items = parseTodo(raw).items
    expect(items).toHaveLength(2)
    expect(items.find((item) => item.content === '回复邮件')?.quadrant).toBe('q3')
    expect(items.find((item) => item.content === '修复支付回调')?.quadrant).toBe('q1')
  })

  it('移动到原象限时原文不变', () => {
    let raw = todoTemplate()
    raw = addTodo(raw, 'q2', { content: '梳理文档' })
    const item = parseTodo(raw).items[0]

    expect(moveTodo(raw, item, 'q2')).toBe(raw)
  })
})

describe('完成状态', () => {
  it('勾选后记录完成日期，取消后移除', () => {
    let raw = todoTemplate()
    raw = addTodo(raw, 'q1', { content: '修复支付回调', due: '2026-11-18' })
    let item = parseTodo(raw).items[0]

    raw = toggleTodo(raw, item, '2026-11-16')
    item = parseTodo(raw).items[0]
    expect(item.done).toBe(true)
    expect(item.doneDate).toBe('2026-11-16')
    expect(item.due).toBe('2026-11-18')

    raw = toggleTodo(raw, item, '2026-11-16')
    const reopened = parseTodo(raw).items[0]
    expect(reopened.done).toBe(false)
    expect(reopened.doneDate).toBeNull()
    expect(reopened.due).toBe('2026-11-18')
  })
})

describe('多象限定位', () => {
  it('能操作后面象限里的条目', () => {
    let raw = todoTemplate()
    raw = addTodo(raw, 'q1', { content: '第一象限' })
    raw = addTodo(raw, 'q4', { content: '第四象限' })
    const fourth = parseTodo(raw).items.find((item) => item.content === '第四象限')!

    raw = toggleTodo(raw, fourth, '2026-11-16')
    const updated = parseTodo(raw).items.find((item) => item.content === '第四象限')!
    expect(updated.done).toBe(true)
  })
})
