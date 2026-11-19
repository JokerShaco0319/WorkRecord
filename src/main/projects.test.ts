import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addCategory,
  archiveFile,
  archiveFolder,
  assertRelativePath,
  assertSegment,
  createFolder,
  createProject,
  importFiles,
  listArchived,
  listProjects,
  moveFile,
  readProject,
  renameFile,
  renameFolder,
  resolveInsideCategory,
  restoreArchived,
  setProjectStatus
} from './projects'

let vault: string
let sourceDir: string

beforeEach(async () => {
  vault = await mkdtemp(join(tmpdir(), 'workrecord-vault-'))
  sourceDir = await mkdtemp(join(tmpdir(), 'workrecord-src-'))
  await mkdir(join(vault, 'projects'), { recursive: true })
})

afterEach(async () => {
  await rm(vault, { recursive: true, force: true })
  await rm(sourceDir, { recursive: true, force: true })
})

describe('createProject / readProject', () => {
  it('创建项目目录、默认分类与元文件', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    const project = await readProject(vault, '项目A')

    expect(project.name).toBe('项目A')
    expect(project.categories).toEqual(['需求', '设计', '开发', '资料', '归档'])
    expect(project.fileCount).toBe(0)
    expect(project.files).toEqual([])

    const meta = await readFile(join(vault, 'projects', '项目A', '_project.md'), 'utf-8')
    expect(meta).toContain('categories:')
    expect(meta).toContain('# 项目A')
  })

  it('同名项目不允许重复创建', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await expect(createProject(vault, '项目A', '2026-11-16')).rejects.toThrow()
  })

  it('读取项目描述，并以磁盘目录补全分类', async () => {
    await mkdir(join(vault, 'projects', '项目B'), { recursive: true })
    await writeFile(
      join(vault, 'projects', '项目B', '_project.md'),
      ['---', 'created: 2026-11-16', 'categories:', '  - 需求', '---', '', '# 项目B', '', '二期需求整理'].join(
        '\n'
      ),
      'utf-8'
    )

    const project = await readProject(vault, '项目B')
    expect(project.description).toBe('二期需求整理')
    expect(project.categories).toEqual(['需求'])
  })

  it('磁盘上多出来的分类目录会追加到列表里', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await mkdir(join(vault, 'projects', '项目A', '会议纪要'), { recursive: true })

    expect((await readProject(vault, '项目A')).categories).toContain('会议纪要')
  })
})

describe('addCategory', () => {
  it('新建分类并写入元文件', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await addCategory(vault, '项目A', '会议纪要', '2026-11-16')

    const project = await readProject(vault, '项目A')
    expect(project.categories).toContain('会议纪要')

    const meta = await readFile(join(vault, 'projects', '项目A', '_project.md'), 'utf-8')
    expect(meta).toContain('  - 会议纪要')
  })

  it('重复添加不产生重复项', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await addCategory(vault, '项目A', '会议纪要', '2026-11-16')
    await addCategory(vault, '项目A', '会议纪要', '2026-11-16')

    const meta = await readFile(join(vault, 'projects', '项目A', '_project.md'), 'utf-8')
    expect(meta.match(/会议纪要/g)).toHaveLength(1)
  })
})

describe('importFiles', () => {
  it('复制文件到指定分类', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    const source = join(sourceDir, '需求说明.md')
    await writeFile(source, '# 需求', 'utf-8')

    await importFiles(vault, '项目A', '需求', '', [source])

    const project = await readProject(vault, '项目A')
    expect(project.files).toHaveLength(1)
    expect(project.files[0]).toMatchObject({ category: '需求', name: '需求说明.md' })
    expect(project.fileCount).toBe(1)
  })

  it('同名文件自动改名', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    const source = join(sourceDir, '设计稿.png')
    await writeFile(source, 'image', 'utf-8')

    await importFiles(vault, '项目A', '设计', '', [source])
    await importFiles(vault, '项目A', '设计', '', [source])

    const names = (await readProject(vault, '项目A')).files.map((file) => file.name).sort()
    expect(names).toEqual(['设计稿 (1).png', '设计稿.png'])
  })

  it('自动创建尚未存在的分类目录', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    const source = join(sourceDir, 'a.txt')
    await writeFile(source, 'x', 'utf-8')

    await importFiles(vault, '项目A', '临时', '', [source])

    const project = await readProject(vault, '项目A')
    expect(project.categories).toContain('临时')
    expect(project.files[0].category).toBe('临时')
  })

  it('忽略不是文件的路径', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    const folder = join(sourceDir, '文件夹')
    await mkdir(folder)

    await importFiles(vault, '项目A', '资料', '', [folder, join(sourceDir, '不存在.txt')])
    expect((await readProject(vault, '项目A')).fileCount).toBe(0)
  })
})

describe('listProjects', () => {
  it('列出项目并按最近更新排序', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await createProject(vault, '项目B', '2026-11-16')

    const source = join(sourceDir, 'b.md')
    await writeFile(source, 'x', 'utf-8')
    await importFiles(vault, '项目B', '需求', '', [source])

    const projects = await listProjects(vault)
    expect(projects.map((project) => project.name)).toEqual(['项目B', '项目A'])
    expect(projects[0].fileCount).toBe(1)
    expect(projects[1].fileCount).toBe(0)
  })
})

describe('路径安全', () => {
  it('拒绝路径分隔符与上级目录', () => {
    expect(() => assertSegment('../evil', '项目名')).toThrow()
    expect(() => assertSegment('a/b', '分类名')).toThrow()
    expect(() => assertSegment('..', '文件名')).toThrow()
    expect(() => assertSegment('  ', '项目名')).toThrow()
    expect(assertSegment(' 项目A ', '项目名')).toBe('项目A')
  })

  it('拼出的文件路径不会逃出项目目录', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    expect(() => resolveInsideCategory(vault, '项目A', '../..', 'x.md')).toThrow()
    expect(() => resolveInsideCategory(vault, '项目A', '需求', '../../x.md')).toThrow()
    expect(assertRelativePath('a/b', '路径')).toBe('a/b')
    expect(() => assertRelativePath('a/../b', '路径')).toThrow()
  })
})

describe('文件重命名与移动', () => {
  it('重命名文件', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    const source = join(sourceDir, 'a.md')
    await writeFile(source, 'x', 'utf-8')
    await importFiles(vault, '项目A', '需求', '', [source])

    await renameFile(vault, '项目A', '需求', 'a.md', 'b.md')

    expect((await readProject(vault, '项目A')).files.map((file) => file.name)).toEqual(['b.md'])
  })

  it('重命名到已存在的名字会报错', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await writeFile(join(sourceDir, 'a.md'), 'x', 'utf-8')
    await writeFile(join(sourceDir, 'b.md'), 'y', 'utf-8')
    await importFiles(vault, '项目A', '需求', '', [join(sourceDir, 'a.md'), join(sourceDir, 'b.md')])

    await expect(renameFile(vault, '项目A', '需求', 'a.md', 'b.md')).rejects.toThrow()
  })

  it('移动到其它分类，重名时自动改名', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await writeFile(join(sourceDir, 'a.md'), 'x', 'utf-8')
    await importFiles(vault, '项目A', '需求', '', [join(sourceDir, 'a.md')])
    await importFiles(vault, '项目A', '设计', '', [join(sourceDir, 'a.md')])

    await moveFile(vault, '项目A', '需求', 'a.md', '设计')

    const files = (await readProject(vault, '项目A')).files
    expect(files.filter((file) => file.category === '需求')).toHaveLength(0)
    expect(
      files
        .filter((file) => file.category === '设计')
        .map((file) => file.name)
        .sort()
    ).toEqual(['a (1).md', 'a.md'])
  })

  it('设置项目状态并写入元文件', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await setProjectStatus(vault, '项目A', 'archived')

    expect((await readProject(vault, '项目A')).status).toBe('archived')

    const meta = await readFile(join(vault, 'projects', '项目A', '_project.md'), 'utf-8')
    expect(meta).toContain('status: archived')
    expect(meta).toContain('categories:')
  })
})

describe('子目录', () => {
  it('创建嵌套目录并按层级读取', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await createFolder(vault, '项目A', '需求', '', '草图')
    await createFolder(vault, '项目A', '需求', '草图', 'v1')

    await writeFile(join(sourceDir, 'a.md'), 'x', 'utf-8')
    await importFiles(vault, '项目A', '需求', '草图/v1', [join(sourceDir, 'a.md')])

    const project = await readProject(vault, '项目A')
    expect(project.folders.map((folder) => folder.path)).toEqual(['草图', '草图/v1'])
    expect(project.files[0]).toMatchObject({
      category: '需求',
      path: '草图/v1/a.md',
      name: 'a.md'
    })
    expect(project.fileCount).toBe(1)
  })

  it('重命名子目录中的文件只改文件名', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await createFolder(vault, '项目A', '需求', '', '草图')
    await writeFile(join(sourceDir, 'a.md'), 'x', 'utf-8')
    await importFiles(vault, '项目A', '需求', '草图', [join(sourceDir, 'a.md')])

    await renameFile(vault, '项目A', '需求', '草图/a.md', 'b.md')

    expect((await readProject(vault, '项目A')).files[0].path).toBe('草图/b.md')
  })

  it('同名目录会报错', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await createFolder(vault, '项目A', '需求', '', '草图')

    await expect(createFolder(vault, '项目A', '需求', '', '草图')).rejects.toThrow()
  })

  it('重命名目录，内部文件路径随之变化', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await createFolder(vault, '项目A', '需求', '', '草图')
    await writeFile(join(sourceDir, 'a.md'), 'x', 'utf-8')
    await importFiles(vault, '项目A', '需求', '草图', [join(sourceDir, 'a.md')])

    await renameFolder(vault, '项目A', '需求', '草图', '草图2')

    const project = await readProject(vault, '项目A')
    expect(project.folders.map((folder) => folder.path)).toEqual(['草图2'])
    expect(project.files[0].path).toBe('草图2/a.md')
  })

  it('重命名嵌套目录只改最后一级', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await createFolder(vault, '项目A', '需求', '', '草图')
    await createFolder(vault, '项目A', '需求', '草图', 'v1')

    await renameFolder(vault, '项目A', '需求', '草图/v1', 'v2')

    expect(
      (await readProject(vault, '项目A')).folders.map((folder) => folder.path).sort()
    ).toEqual(['草图', '草图/v2'])
  })

  it('重命名为已存在的目录会报错', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await createFolder(vault, '项目A', '需求', '', '草图')
    await createFolder(vault, '项目A', '需求', '', '草图2')

    await expect(renameFolder(vault, '项目A', '需求', '草图', '草图2')).rejects.toThrow()
  })
})

describe('归档', () => {
  it('归档文件后不在项目文件里展示，归档列表保留原路径', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await writeFile(join(sourceDir, 'a.md'), 'x', 'utf-8')
    await importFiles(vault, '项目A', '需求', '', [join(sourceDir, 'a.md')])

    await archiveFile(vault, '项目A', '需求', 'a.md')

    expect((await readProject(vault, '项目A')).fileCount).toBe(0)
    expect(await listArchived(vault, '项目A')).toEqual([
      expect.objectContaining({ category: '需求', path: 'a.md', name: 'a.md' })
    ])
    expect(existsSync(join(vault, 'projects', '项目A', '.archive', '需求', 'a.md'))).toBe(true)
  })

  it('恢复归档文件回到原位置', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await createFolder(vault, '项目A', '需求', '', '草图')
    await writeFile(join(sourceDir, 'a.md'), 'x', 'utf-8')
    await importFiles(vault, '项目A', '需求', '草图', [join(sourceDir, 'a.md')])
    await archiveFile(vault, '项目A', '需求', '草图/a.md')

    await restoreArchived(vault, '项目A', '需求', '草图/a.md')

    const project = await readProject(vault, '项目A')
    expect(project.files[0]).toMatchObject({ category: '需求', path: '草图/a.md' })
    expect(await listArchived(vault, '项目A')).toEqual([])
  })

  it('归档目录保留内部结构', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await createFolder(vault, '项目A', '需求', '', '草图')
    await writeFile(join(sourceDir, 'a.md'), 'x', 'utf-8')
    await importFiles(vault, '项目A', '需求', '草图', [join(sourceDir, 'a.md')])

    await archiveFolder(vault, '项目A', '需求', '草图')

    const project = await readProject(vault, '项目A')
    expect(project.folders).toEqual([])
    expect(project.fileCount).toBe(0)
    expect(await listArchived(vault, '项目A')).toEqual([
      expect.objectContaining({ category: '需求', path: '草图/a.md' })
    ])
  })

  it('归档同名文件不覆盖已有文件', async () => {
    await createProject(vault, '项目A', '2026-11-16')
    await writeFile(join(sourceDir, 'a.md'), 'x', 'utf-8')
    await importFiles(vault, '项目A', '需求', '', [join(sourceDir, 'a.md')])
    await archiveFile(vault, '项目A', '需求', 'a.md')

    await writeFile(join(join(vault, 'projects', '项目A', '需求'), 'a.md'), 'y', 'utf-8')
    await archiveFile(vault, '项目A', '需求', 'a.md')

    const names = (await listArchived(vault, '项目A')).map((file) => file.name).sort()
    expect(names).toEqual(['a (1).md', 'a.md'])
  })
})
