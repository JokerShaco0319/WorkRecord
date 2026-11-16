import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

export interface EncryptedPayload {
  version: 1
  iv: string
  tag: string
  data: string
}

/** 用主密码与盐派生 32 字节密钥；scrypt 的计算成本本身就是暴力破解的门槛 */
export function deriveKey(password: string, salt: string): Buffer {
  return scryptSync(password, Buffer.from(salt, 'base64'), 32)
}

export function encryptJson(key: Buffer, value: unknown): EncryptedPayload {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()])

  return {
    version: 1,
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    data: data.toString('base64')
  }
}

export function decryptJson<T>(key: Buffer, payload: EncryptedPayload): T {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(payload.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'))
  const data = Buffer.concat([
    decipher.update(Buffer.from(payload.data, 'base64')),
    decipher.final()
  ])
  return JSON.parse(data.toString('utf8')) as T
}
