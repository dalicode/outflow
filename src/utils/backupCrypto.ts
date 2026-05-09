/**
 * Backup crypto utilities — encrypts and compresses database backups.
 *
 * Format envelope (JSON):
 * {
 *   version: 1,
 *   format: "gzip+aes",
 *   salt: "base64...",
 *   iv: "base64...",
 *   ciphertext: "base64..."
 * }
 *
 * Pipeline: JSON string → gzip → AES-256-GCM (PBKDF2 key)
 */

const ENVELOPE_VERSION = 1
const FORMAT = "gzip+aes"
const ITERATIONS = 100_000
const KEY_LENGTH = 256

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

async function getPasswordKey(
  password: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"],
  )
}

async function compressBytes(data: Uint8Array): Promise<Uint8Array> {
  const stream = new CompressionStream("gzip")
  const writer = stream.writable.getWriter()
  writer.write(data as BufferSource)
  writer.close()
  const chunks: Uint8Array[] = []
  const reader = stream.readable.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

async function decompressBytes(data: Uint8Array): Promise<Uint8Array> {
  const stream = new DecompressionStream("gzip")
  const writer = stream.writable.getWriter()
  writer.write(data as BufferSource)
  writer.close()
  const chunks: Uint8Array[] = []
  const reader = stream.readable.getReader()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

interface EncryptedEnvelope {
  version: number
  format: string
  salt: string
  iv: string
  ciphertext: string
}

export async function encryptBackup(
  data: Record<string, unknown>,
  password: string,
): Promise<EncryptedEnvelope> {
  const json = JSON.stringify(data)
  const enc = new TextEncoder()
  const compressed = await compressBytes(enc.encode(json))

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await getPasswordKey(password, salt)

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    compressed as BufferSource,
  )

  return {
    version: ENVELOPE_VERSION,
    format: FORMAT,
    salt: bufToBase64(salt.buffer),
    iv: bufToBase64(iv.buffer),
    ciphertext: bufToBase64(encrypted),
  }
}

export async function decryptBackup(
  envelope: EncryptedEnvelope,
  password: string,
): Promise<Record<string, unknown>> {
  if (envelope.version !== ENVELOPE_VERSION) {
    throw new Error(`Unsupported backup version: ${envelope.version}`)
  }
  if (envelope.format !== FORMAT) {
    throw new Error(`Unsupported backup format: ${envelope.format}`)
  }

  const salt = new Uint8Array(base64ToBuf(envelope.salt))
  const iv = new Uint8Array(base64ToBuf(envelope.iv))
  const key = await getPasswordKey(password, salt)

  let decrypted: ArrayBuffer
  try {
    decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      base64ToBuf(envelope.ciphertext),
    )
  } catch {
    throw new Error("Incorrect password or corrupted backup file.")
  }

  const decompressed = await decompressBytes(new Uint8Array(decrypted))
  const text = new TextDecoder().decode(decompressed)
  return JSON.parse(text) as Record<string, unknown>
}

export function isEncryptedEnvelope(
  data: unknown,
): data is EncryptedEnvelope {
  return (
    typeof data === "object" &&
    data !== null &&
    "version" in data &&
    "format" in data &&
    "salt" in data &&
    "iv" in data &&
    "ciphertext" in data
  )
}
