const ENCRYPTION_SECRET =
  process.env.SUPABASE_ENCRYPTION_KEY || 'dev-supabase-encryption-key-change-in-production'
const ALGORITHM = 'AES-GCM'
const IV_LENGTH = 12
const TAG_LENGTH = 16

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const toBase64 = (bytes: Uint8Array): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64')
  }
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

const fromBase64 = (value: string): Uint8Array => {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'))
  }
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const getCryptoKey = async (): Promise<CryptoKey> => {
  const material = await crypto.subtle.digest('SHA-256', encoder.encode(ENCRYPTION_SECRET))
  return crypto.subtle.importKey('raw', material, { name: ALGORITHM }, false, ['encrypt', 'decrypt'])
}

export interface EncryptedData {
  encrypted: string
  iv: string
  authTag: string
}

export async function encrypt(text: string): Promise<EncryptedData> {
  const key = await getCryptoKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const payload = encoder.encode(text)

  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv,
      tagLength: TAG_LENGTH * 8
    },
    key,
    payload
  )

  const cipherBytes = new Uint8Array(cipherBuffer)
  const encrypted = cipherBytes.slice(0, -TAG_LENGTH)
  const authTag = cipherBytes.slice(-TAG_LENGTH)

  return {
    encrypted: toBase64(encrypted),
    iv: toBase64(iv),
    authTag: toBase64(authTag)
  }
}

export async function decrypt(encrypted: string, iv: string, authTag: string): Promise<string> {
  const key = await getCryptoKey()
  const encryptedBytes = fromBase64(encrypted)
  const authTagBytes = fromBase64(authTag)
  const ivBytes = Uint8Array.from(fromBase64(iv))

  const combined = new Uint8Array(encryptedBytes.length + authTagBytes.length)
  combined.set(encryptedBytes)
  combined.set(authTagBytes, encryptedBytes.length)

  const plainBuffer = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: ivBytes,
      tagLength: TAG_LENGTH * 8
    },
    key,
    combined
  )

  return decoder.decode(plainBuffer)
}

export async function encryptForStorage(text: string): Promise<string> {
  const data = await encrypt(text)
  return JSON.stringify(data)
}

export async function decryptFromStorage(stored: string): Promise<string> {
  const data = JSON.parse(stored) as EncryptedData
  return decrypt(data.encrypted, data.iv, data.authTag)
}
