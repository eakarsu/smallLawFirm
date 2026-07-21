import assert from 'node:assert/strict'
import test from 'node:test'
import { generateToken, verifyToken } from '../src/lib/auth'

const actor = { id: 'user-1', email: 'counsel@example.test', name: 'Counsel', role: 'ATTORNEY' }

test('session signing fails closed without a strong secret', () => {
  const previous = process.env.NEXTAUTH_SECRET
  delete process.env.NEXTAUTH_SECRET
  assert.throws(() => generateToken(actor), /at least 32/)
  if (previous === undefined) delete process.env.NEXTAUTH_SECRET
  else process.env.NEXTAUTH_SECRET = previous
})

test('session tokens enforce signature, issuer, audience, and algorithm', () => {
  const previous = process.env.NEXTAUTH_SECRET
  process.env.NEXTAUTH_SECRET = 'unit-test-authentication-secret-with-32-bytes'
  const token = generateToken(actor)
  const payload = verifyToken(token) as (typeof actor & { iat: number; exp: number; aud: string; iss: string }) | null
  assert.equal(payload?.id, actor.id)
  assert.equal(payload?.aud, 'small-law-firm-web')
  assert.equal(payload?.iss, 'small-law-firm')
  assert.equal(typeof payload?.iat, 'number')
  assert.equal(typeof payload?.exp, 'number')
  assert.equal(verifyToken(`${token.slice(0, -1)}x`), null)
  if (previous === undefined) delete process.env.NEXTAUTH_SECRET
  else process.env.NEXTAUTH_SECRET = previous
})
