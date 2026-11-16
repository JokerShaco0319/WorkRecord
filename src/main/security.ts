import { randomBytes } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { decryptJson, deriveKey, encryptJson, type EncryptedPayload } from './crypto'

interface SecurityFile {
  version: 1
  salt: string
  verifier: EncryptedPayload
}

const VERIFIER_TEXT = 'workrecord'
const MIN_PASSWORD_LENGTH = 6

let sessionKey: Buffer | null = null
let sessionVault: string | null = null

export function securityPath(vaultPath: string): string {
  return join(vaultPath, '.workrecord', 'security.json')
}

export async function readSecurity(vaultPath: string): Promise<SecurityFile | null> {
  try {
    const parsed = JSON.parse(await readFile(securityPath(vaultPath), 'utf-8')) as SecurityFile
    if (!parsed?.salt || !parsed?.verifier) return null
    return parsed
  } catch {
    return null
  }
}

export async function isConfigured(vaultPath: string): Promise<boolean> {
  return (await readSecurity(vaultPath)) !== null
}

export function isUnlocked(vaultPath?: string): boolean {
  if (!sessionKey) return false
  return vaultPath ? sessionVault === vaultPath : true
}

export function lockSession(): void {
  sessionKey = null
  sessionVault = null
}

export function requireKey(vaultPath?: string): Buffer {
  if (!sessionKey || (vaultPath && sessionVault !== vaultPath)) {
    throw new Error('加密资产已锁定，请先解锁')
  }
  return sessionKey
}

export async function setupPassword(vaultPath: string, password: string): Promise<void> {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`主密码至少 ${MIN_PASSWORD_LENGTH} 位`)
  }
  if (await isConfigured(vaultPath)) throw new Error('主密码已经设置过了')

  const salt = randomBytes(16).toString('base64')
  const key = deriveKey(password, salt)
  const verifier = encryptJson(key, { check: VERIFIER_TEXT })

  await mkdir(join(vaultPath, '.workrecord'), { recursive: true })
  await writeFile(
    securityPath(vaultPath),
    JSON.stringify({ version: 1, salt, verifier }, null, 2),
    'utf-8'
  )

  sessionKey = key
  sessionVault = vaultPath
}

export async function unlockSession(vaultPath: string, password: string): Promise<boolean> {
  const file = await readSecurity(vaultPath)
  if (!file) throw new Error('尚未设置主密码')

  const key = deriveKey(password, file.salt)
  try {
    const check = decryptJson<{ check?: string }>(key, file.verifier)
    if (check.check !== VERIFIER_TEXT) return false
  } catch {
    return false
  }

  sessionKey = key
  sessionVault = vaultPath
  return true
}
