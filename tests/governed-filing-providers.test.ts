import assert from 'node:assert/strict'
import test from 'node:test'
import { createFilingProviders } from '../src/lib/governed-filing-providers'

const keys = [
  'FILING_STORAGE_URL', 'FILING_STORAGE_TOKEN', 'FILING_TEMPLATE_URL', 'FILING_TEMPLATE_TOKEN',
  'FILING_TEMPLATE_ALLOWED_AUTHORITIES', 'FILING_TEMPLATE_ALLOWED_HOSTS',
] as const

function preserveEnvironment() {
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
  return () => {
    for (const key of keys) {
      if (prior[key] === undefined) delete process.env[key]
      else process.env[key] = prior[key]
    }
  }
}

test('provider configuration is lazy for reads and fails closed on use', { concurrency: false }, async () => {
  const restore = preserveEnvironment()
  try {
    delete process.env.FILING_STORAGE_URL
    delete process.env.FILING_STORAGE_TOKEN
    const providers = createFilingProviders()
    await assert.rejects(providers.storage.put({ idempotencyKey: 'object-1' }), (error: unknown) => {
      return error instanceof Error && 'code' in error && error.code === 'PROVIDER_CONFIGURATION'
    })
  } finally { restore() }
})

test('template adapter sends authenticated idempotent request and enforces authority allowlists', { concurrency: false }, async () => {
  const restore = preserveEnvironment()
  const originalFetch = globalThis.fetch
  try {
    process.env.FILING_TEMPLATE_URL = 'https://templates.example.test'
    process.env.FILING_TEMPLATE_TOKEN = 'provider-token-with-16-characters'
    process.env.FILING_TEMPLATE_ALLOWED_AUTHORITIES = 'Court Forms Office'
    process.env.FILING_TEMPLATE_ALLOWED_HOSTS = 'court.example.test'
    let authorization = ''
    let idempotency = ''
    globalThis.fetch = async (_input, init) => {
      authorization = new Headers(init?.headers).get('authorization') || ''
      idempotency = new Headers(init?.headers).get('idempotency-key') || ''
      return new Response(JSON.stringify({ authority: 'Court Forms Office', sourceUri: 'https://court.example.test/forms/1' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }
    const result = await createFilingProviders().templates.resolve('NY', '2026-07-01T00:00:00.000Z')
    assert.equal(result.authority, 'Court Forms Office')
    assert.equal(authorization, 'Bearer provider-token-with-16-characters')
    assert.equal(idempotency, 'template:NY:2026-07-01')

    globalThis.fetch = async () => new Response(JSON.stringify({ authority: 'Unknown Blog', sourceUri: 'https://court.example.test/forms/1' }), { status: 200 })
    await assert.rejects(createFilingProviders().templates.resolve('NY', '2026-07-01T00:00:00.000Z'), (error: unknown) => {
      return error instanceof Error && 'code' in error && error.code === 'TEMPLATE_SOURCE_UNTRUSTED'
    })
  } finally {
    globalThis.fetch = originalFetch
    restore()
  }
})
