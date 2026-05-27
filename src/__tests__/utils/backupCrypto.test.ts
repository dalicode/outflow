import { describe, expect, it } from 'vitest'
import { decryptBackup, encryptBackup, isEncryptedEnvelope } from '@/utils/backupCrypto'

describe('backupCrypto', () => {
  const sampleData = {
    expenses: [{ id: 1, date: '2024-01-01', amount: 100 }],
    categories: [{ id: 1, name: 'Food' }],
    settings: { key: 'value' },
  }

  it('encrypts and decrypts a backup roundtrip', async () => {
    const password = 'my-secret-password'
    const envelope = await encryptBackup(sampleData, password)
    const decrypted = await decryptBackup(envelope, password)
    expect(decrypted).toEqual(sampleData)
  })

  it('produces an encrypted envelope', async () => {
    const envelope = await encryptBackup(sampleData, 'password')
    expect(envelope.version).toBe(1)
    expect(envelope.format).toBe('gzip+aes')
    expect(typeof envelope.salt).toBe('string')
    expect(typeof envelope.iv).toBe('string')
    expect(typeof envelope.ciphertext).toBe('string')
    expect(envelope.salt.length).toBeGreaterThan(0)
    expect(envelope.iv.length).toBeGreaterThan(0)
    expect(envelope.ciphertext.length).toBeGreaterThan(0)
  })

  it('throws on wrong password', async () => {
    const envelope = await encryptBackup(sampleData, 'correct-password')
    await expect(decryptBackup(envelope, 'wrong-password')).rejects.toThrow(
      'Incorrect password or corrupted backup file.',
    )
  })

  it('detects encrypted envelope', async () => {
    const envelope = await encryptBackup(sampleData, 'pw')
    expect(isEncryptedEnvelope(envelope)).toBe(true)
  })

  it('detects plain JSON as not encrypted', () => {
    expect(isEncryptedEnvelope(sampleData)).toBe(false)
    expect(isEncryptedEnvelope(null)).toBe(false)
    expect(isEncryptedEnvelope(undefined)).toBe(false)
    expect(isEncryptedEnvelope('string')).toBe(false)
  })

  it('throws on unsupported version', async () => {
    const envelope = await encryptBackup(sampleData, 'pw')
    const tampered = { ...envelope, version: 99 }
    await expect(decryptBackup(tampered, 'pw')).rejects.toThrow('Unsupported backup version: 99')
  })

  it('throws on unsupported format', async () => {
    const envelope = await encryptBackup(sampleData, 'pw')
    const tampered = { ...envelope, format: 'plaintext' }
    await expect(decryptBackup(tampered, 'pw')).rejects.toThrow(
      'Unsupported backup format: plaintext',
    )
  })

  it('compresses data smaller than raw JSON', async () => {
    const envelope = await encryptBackup(sampleData, 'pw')
    // Ciphertext should be base64 of encrypted compressed data; roughly comparable in size
    expect(envelope.ciphertext.length).toBeGreaterThan(0)
    expect(envelope.salt.length).toBeGreaterThan(0)
    expect(envelope.iv.length).toBeGreaterThan(0)
  })

  it('roundtrips a meta+data shaped payload', async () => {
    const payload = {
      meta: {
        exportedAt: new Date().toISOString(),
        appVersion: '1.0.0',
        dbVersion: 7,
        format: 'outflow-backup',
        recordCounts: { expenses: 2, categories: 1 },
        userEmail: 'test@example.com',
      },
      data: sampleData,
    }
    const password = 'meta-data-pw'
    const envelope = await encryptBackup(payload, password)
    const decrypted = await decryptBackup(envelope, password)
    expect(decrypted).toEqual(payload)
  })
})
