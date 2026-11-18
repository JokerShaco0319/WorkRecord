const { existsSync, rmSync } = require('node:fs')
const { join } = require('node:path')

/**
 * WebGPU/DirectX 着色器编译器，本应用不使用 WebGPU。
 * 删掉可以让安装包小约 8-10MB；Chromium 启动不依赖它。
 */
module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return

  const target = join(context.appOutDir, 'dxcompiler.dll')
  if (!existsSync(target)) return

  rmSync(target, { force: true })
  console.log('afterPack: removed dxcompiler.dll')
}
