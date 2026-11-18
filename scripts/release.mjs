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

const manifest = {
  version: pkg.version,
  date: release.date,
  notes: release.notes,
  downloads: {
    github: `https://github.com/${repo.github.owner}/${repo.github.repo}/releases/download/${tag}/${setup}`,
    gitee: `https://gitee.com/${repo.gitee.owner}/${repo.gitee.repo}/releases/download/${tag}/${setup}`,
    default: `https://github.com/${repo.github.owner}/${repo.github.repo}/releases/latest`
  }
}

await writeFile(resolve(root, 'update.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

console.log(`已生成 update.json（${tag}）`)
console.log('')
console.log('发布步骤：')
console.log(`  1. npm run dist`)
console.log(
  `  2. 在 GitHub 与 Gitee 各创建 Release ${tag}，上传 release/${setup} 与 release/WorkRecord-Portable-${pkg.version}.exe`
)
console.log(`  3. 提交并推送 update.json 到两个仓库的 ${repo.github.branch} 分支`)
