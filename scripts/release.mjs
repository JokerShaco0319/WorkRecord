import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const changelog = JSON.parse(await readFile(resolve(root, 'src/shared/changelog.json'), 'utf8'))
const repo = JSON.parse(await readFile(resolve(root, 'src/shared/update-repo.json'), 'utf8'))

const release = changelog.releases.find((item) => item.version === pkg.version)
if (!release) {
  console.error(`src/shared/changelog.json 缺少 ${pkg.version} 的更新说明`)
  process.exit(1)
}

const setup = `WorkRecord-Setup-${pkg.version}.exe`
const tag = `v${pkg.version}`

const githubUrl = `https://github.com/${repo.github.owner}/${repo.github.repo}/releases/download/${tag}/${setup}`
const gitcodeUrl = `https://gitcode.com/${repo.gitcode.owner}/${repo.gitcode.repo}/releases/download/${tag}/${setup}`

let sha256 = null
try {
  sha256 = createHash('sha256')
    .update(await readFile(resolve(root, 'release', setup)))
    .digest('hex')
} catch {
  console.warn(`未找到 release/${setup}，清单将不包含 sha256`)
}

const manifest = {
  version: pkg.version,
  date: release.date,
  notes: release.notes,
  ...(sha256 ? { sha256 } : {}),
  downloads: {
    github: githubUrl,
    gitcode: gitcodeUrl,
    default: githubUrl
  }
}

await writeFile(resolve(root, 'update.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

console.log(`已生成 update.json（${tag}）`)
console.log('')
console.log('发布步骤：')
console.log(`  1. npm run dist`)
console.log(
  `  2. GitHub 与 GitCode 各创建 Release ${tag}，上传 release/${setup} 与 release/WorkRecord-Portable-${pkg.version}.exe`
)
console.log(`  3. 提交并推送 update.json 到两个仓库的 ${repo.github.branch} 分支`)
