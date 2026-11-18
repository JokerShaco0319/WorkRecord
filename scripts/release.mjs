import { readFile, stat, writeFile } from 'node:fs/promises'
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
const giteeUrl = `https://gitee.com/${repo.gitee.owner}/${repo.gitee.repo}/releases/download/${tag}/${setup}`

// Gitee 免费仓库的发行版附件单文件上限 100MB，超过就回退到 GitHub 的下载地址
const GITEE_ATTACHMENT_LIMIT = 90 * 1024 * 1024
const setupSize = await stat(resolve(root, 'release', setup))
  .then((info) => info.size)
  .catch(() => null)
const giteeHostsAsset = setupSize !== null && setupSize <= GITEE_ATTACHMENT_LIMIT

const manifest = {
  version: pkg.version,
  date: release.date,
  notes: release.notes,
  downloads: {
    github: githubUrl,
    gitee: giteeHostsAsset ? giteeUrl : githubUrl,
    default: `https://github.com/${repo.github.owner}/${repo.github.repo}/releases/latest`
  }
}

await writeFile(resolve(root, 'update.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

console.log(`已生成 update.json（${tag}）`)
if (!giteeHostsAsset) {
  console.log('提示：安装包超过 Gitee 附件上限，Gitee 清单里的下载地址已回退到 GitHub')
}
console.log('')
console.log('发布步骤：')
console.log(`  1. npm run dist`)
console.log(
  `  2. GitHub 创建 Release ${tag}，上传 release/${setup} 与 release/WorkRecord-Portable-${pkg.version}.exe`
)
console.log(`  3. Gitee 创建 Release ${tag}，只保留 update.json 清单同步`)
console.log(`  4. 提交并推送 update.json 到两个仓库的 ${repo.github.branch} 分支`)
