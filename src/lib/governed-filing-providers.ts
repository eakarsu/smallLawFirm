import type { FilingProviders } from './governed-filing-workflow'

class ProviderConfigurationError extends Error {
  readonly code = 'PROVIDER_CONFIGURATION'
}

class ProviderRequestError extends Error {
  readonly code: string

  constructor(message: string, code = 'PROVIDER_REQUEST_FAILED') {
    super(message)
    this.code = code
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new ProviderConfigurationError(`${name} is required`)
  return value
}

function endpoint(name: string): URL {
  const parsed = new URL(required(name))
  if (parsed.protocol !== 'https:') throw new ProviderConfigurationError(`${name} must use HTTPS`)
  return parsed
}

function token(name: string): string {
  const value = required(name)
  if (value.length < 16) throw new ProviderConfigurationError(`${name} must contain at least 16 characters`)
  return value
}

function allowList(name: string): Set<string> {
  const values = required(name).split(',').map((value) => value.trim()).filter(Boolean)
  if (values.length === 0) throw new ProviderConfigurationError(`${name} must contain at least one value`)
  return new Set(values)
}

class JsonProvider {
  constructor(
    private readonly name: string,
    private readonly urlName: string,
    private readonly tokenName: string,
  ) {}

  async post(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
    const baseUrl = endpoint(this.urlName)
    const credential = token(this.tokenName)
    let response: Response
    try {
      response = await fetch(new URL(path, baseUrl), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${credential}`,
          'content-type': 'application/json',
          'idempotency-key': typeof body.idempotencyKey === 'string' ? body.idempotencyKey : '',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15_000),
        cache: 'no-store',
      })
    } catch {
      throw new ProviderRequestError(`${this.name} provider was unavailable`)
    }
    if (!response.ok) {
      throw new ProviderRequestError(`${this.name} provider rejected the request`, `${this.name.toUpperCase()}_${response.status}`)
    }
    const value: unknown = await response.json().catch(() => null)
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new ProviderRequestError(`${this.name} provider returned an invalid response`)
    }
    return value as Record<string, unknown>
  }
}

export function createFilingProviders(): FilingProviders {
  const storage = new JsonProvider('storage', 'FILING_STORAGE_URL', 'FILING_STORAGE_TOKEN')
  const ocr = new JsonProvider('ocr', 'FILING_OCR_URL', 'FILING_OCR_TOKEN')
  const signature = new JsonProvider('signature', 'FILING_ESIGN_URL', 'FILING_ESIGN_TOKEN')
  const filing = new JsonProvider('filing', 'FILING_COURT_URL', 'FILING_COURT_TOKEN')
  const templates = new JsonProvider('template', 'FILING_TEMPLATE_URL', 'FILING_TEMPLATE_TOKEN')

  return {
    storage: {
      put: (value) => storage.post('/v1/objects', value),
      dispose: (value) => storage.post('/v1/dispositions', value),
    },
    ocr: { extract: (value) => ocr.post('/v1/extractions', value) },
    signature: {
      request: (value) => signature.post('/v1/envelopes', value),
      status: (value) => signature.post('/v1/envelopes/status', value),
    },
    filing: { submit: (value) => filing.post('/v1/filings', value) },
    templates: {
      async resolve(jurisdiction, asOf) {
        const allowedAuthorities = allowList('FILING_TEMPLATE_ALLOWED_AUTHORITIES')
        const allowedHosts = allowList('FILING_TEMPLATE_ALLOWED_HOSTS')
        const result = await templates.post('/v1/templates/resolve', {
          jurisdiction,
          asOf,
          idempotencyKey: `template:${jurisdiction}:${asOf.slice(0, 10)}`,
        })
        const authority = String(result.authority ?? '')
        let host = ''
        try {
          host = new URL(String(result.sourceUri ?? '')).hostname
        } catch {
          throw new ProviderRequestError('Template source URI is invalid', 'TEMPLATE_SOURCE_INVALID')
        }
        if (!allowedAuthorities.has(authority) || !allowedHosts.has(host)) {
          throw new ProviderRequestError('Template source is not authoritative', 'TEMPLATE_SOURCE_UNTRUSTED')
        }
        return result
      },
    },
  }
}
