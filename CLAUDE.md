# WorkRecord 项目约定

## 版本与更新说明

- 每一次优化、修复或调整，版本号末位 +1（补丁版本），例如 `0.2.1` → `0.2.2`
- 同步更新 `src/shared/changelog.json` 与 `CHANGELOG.md`，写清本次变更
- 发布时运行 `npm run dist` 和 `node scripts/release.mjs`，再推送 GitHub / GitCode
- 国内更新源为 GitCode，清单从 `api.gitcode.com` 的 raw 接口读取；Gitee 仅保留旧版本桥接

## 打包与发布

- 安装包命名固定为 `WorkRecord-Setup-<version>.exe` 与 `WorkRecord-Portable-<version>.exe`
- GitHub 与 GitCode 各创建一个 Release，上传上述两个文件
- 更新清单 `update.json` 里的 `sha256` 必须与安装包一致
