import { describe, expect, it } from 'vitest'
import { extractRawLinks, resolveProjectLink } from './links'

describe('链接解析', () => {
  it('解析相对路径、上级目录和项目根路径', () => {
    expect(resolveProjectLink('需求/a.md', '../资料/img.png')).toBe('资料/img.png')
    expect(resolveProjectLink('需求/子/a.md', './img.png')).toBe('需求/子/img.png')
    expect(resolveProjectLink('需求/a.md', '/assets/a.png')).toBe('assets/a.png')
    expect(resolveProjectLink('需求/a.md', 'img%20a.png')).toBe('需求/img a.png')
  })

  it('去掉锚点和查询参数', () => {
    expect(resolveProjectLink('需求/a.md', '../资料/img.png#preview')).toBe('资料/img.png')
    expect(resolveProjectLink('需求/a.md', '../资料/img.png?v=1')).toBe('资料/img.png')
  })

  it('忽略外部链接、锚点和越界路径', () => {
    expect(resolveProjectLink('需求/a.md', 'https://example.com/a.png')).toBeNull()
    expect(resolveProjectLink('需求/a.md', 'mailto:a@b.com')).toBeNull()
    expect(resolveProjectLink('需求/a.md', '#section')).toBeNull()
    expect(resolveProjectLink('需求/a.md', '//cdn.example.com/a.png')).toBeNull()
    expect(resolveProjectLink('需求/a.md', '../../../etc/passwd')).toBeNull()
  })

  it('提取 markdown、引用式和 HTML 链接', () => {
    const content = [
      '![](../资料/a.png)',
      '[文档](../需求/b.md)',
      '[引用][ref]',
      '[ref]: ../资料/c.pdf',
      '<img src="../资料/d.png">',
      '<a href="https://example.com">x</a>',
      '[[项目]]'
    ].join('\n')

    expect(extractRawLinks(content)).toEqual(
      expect.arrayContaining(['../资料/a.png', '../需求/b.md', '../资料/c.pdf', '../资料/d.png'])
    )
  })
})
