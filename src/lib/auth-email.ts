export function authEmailConfiguration() {
  const endpoint = process.env.AUTH_EMAIL_PROVIDER_URL?.trim()
  const credential = process.env.AUTH_EMAIL_PROVIDER_TOKEN?.trim()
  if (!endpoint || !credential || credential.length < 16) throw new Error('AUTH_EMAIL_PROVIDER_NOT_CONFIGURED')
  const url = new URL(endpoint)
  if (url.protocol !== 'https:') throw new Error('AUTH_EMAIL_PROVIDER_NOT_CONFIGURED')
  return { credential, url }
}

export async function sendAuthEmail(kind: 'password-reset' | 'email-verification', email: string, token: string) {
  const { credential, url } = authEmailConfiguration()
  let response: Response
  try {
    response = await fetch(new URL('/v1/auth-email', url), {
      method: 'POST',
      headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' },
      body: JSON.stringify({ kind, email, token }),
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    })
  } catch {
    throw new Error('AUTH_EMAIL_PROVIDER_UNAVAILABLE')
  }
  if (!response.ok) throw new Error('AUTH_EMAIL_PROVIDER_REJECTED')
}
