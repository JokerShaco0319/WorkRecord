import { useMemo, useState, type ReactNode } from 'react'
import type { ProjectFileInfo } from '@shared/api'
import { ChevronRightIcon, FileIcon, FolderIcon } from './icons'

interface Props {
  folders: string[]
  files: ProjectFileInfo[]
  currentPath: string
  onSelectFolder: (path: string) => void
  onOpenFile: (file: ProjectFileInfo) => void
}

interface TreeNode {
  name: string
  path: string
  folders: TreeNode[]
  files: ProjectFileInfo[]
}

function buildTree(folders: string[], files: ProjectFileInfo[]): TreeNode {
  const root: TreeNode = { name: '', path: '', folders: [], files: [] }
  const map = new Map<string, TreeNode>([['', root]])

  const ensure = (path: string): TreeNode => {
    const existing = map.get(path)
    if (existing) return existing

    const index = path.lastIndexOf('/')
    const parentPath = index >= 0 ? path.slice(0, index) : ''
    const parent = ensure(parentPath)
    const node: TreeNode = { name: path.slice(index + 1), path, folders: [], files: [] }
    parent.folders.push(node)
    map.set(path, node)
    return node
  }

  for (const folder of folders) ensure(folder)
  for (const file of files) {
    const index = file.path.lastIndexOf('/')
    const parentPath = index >= 0 ? file.path.slice(0, index) : ''
    ensure(parentPath).files.push(file)
  }

  const sort = (node: TreeNode): void => {
    node.folders.sort((a, b) => a.name.localeCompare(b.name))
    node.files.sort((a, b) => a.name.localeCompare(b.name))
    node.folders.forEach(sort)
  }
  sort(root)

  return root
}

export default function FileTree({ folders, files, currentPath, onSelectFolder, onOpenFile }: Props) {
  const tree = useMemo(() => buildTree(folders, files), [folders, files])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggle(path: string): void {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  function renderNode(node: TreeNode, depth: number): ReactNode {
    return (
      <>
        {node.folders.map((folder) => {
          const isCollapsed = collapsed.has(folder.path)
          const isCurrent = folder.path === currentPath

          return (
            <div key={`folder-${folder.path}`}>
              <div
                className={`group flex items-center gap-1 rounded-md py-1 pr-1 text-[12px] transition-colors ${
                  isCurrent ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-paper hover:text-ink'
                }`}
                style={{ paddingLeft: depth * 12 + 4 }}
              >
                <button
                  type="button"
                  onClick={() => toggle(folder.path)}
                  className="grid h-4 w-4 shrink-0 place-items-center"
                  aria-label={isCollapsed ? '展开' : '收起'}
                >
                  <ChevronRightIcon
                    className={`h-3 w-3 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => onSelectFolder(folder.path)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                >
                  <FolderIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
                  <span className="truncate">{folder.name}</span>
                </button>
              </div>
              {!isCollapsed && renderNode(folder, depth + 1)}
            </div>
          )
        })}

        {node.files.map((file) => (
          <button
            key={`file-${file.path}`}
            type="button"
            onClick={() => onOpenFile(file)}
            title={file.path}
            className="flex w-full items-center gap-1.5 rounded-md py-1 pr-1 text-left text-[12px] text-muted transition-colors hover:bg-paper hover:text-ink"
            style={{ paddingLeft: depth * 12 + 24 }}
          >
            <FileIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate">{file.name}</span>
          </button>
        ))}
      </>
    )
  }

  const isEmpty = tree.folders.length === 0 && tree.files.length === 0

  return (
    <div>
      <div className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted/70">
        目录
      </div>
      {isEmpty ? (
        <p className="px-1 text-[11px] text-muted/60">这个分类还是空的</p>
      ) : (
        <div className="max-h-full">{renderNode(tree, 0)}</div>
      )}
    </div>
  )
}
