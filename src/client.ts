import type { SfmcConfig, SfmcTokenResponse } from './types.js'

interface CacheEntry {
  token: string
  expiresAt: number
}

const tokenCache = new Map<string, CacheEntry>()

function cacheKey(subdomain: string, mid?: string): string {
  return mid ? `${subdomain}:${mid}` : `${subdomain}:parent`
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Fetch a valid access token, auto-refreshing when within 60s of expiry.
 */
export async function getToken(config: SfmcConfig): Promise<string> {
  const key = cacheKey(config.subdomain, config.mid)
  const cached = tokenCache.get(key)

  if (cached && cached.expiresAt - Date.now() > 60_000) {
    return cached.token
  }

  const url = `https://${config.subdomain}.auth.marketingcloudapis.com/v2/token`
  const body: Record<string, string> = {
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  }
  if (config.mid) body.account_id = config.mid

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error_description?: string; error?: string; message?: string }
    throw new Error(err.error_description ?? err.error ?? err.message ?? `Auth failed (${res.status})`)
  }

  const data = await res.json() as SfmcTokenResponse
  tokenCache.set(key, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  })

  return data.access_token
}

/**
 * Make an authenticated REST request to SFMC.
 * Automatically retries on 429 Too Many Requests (up to 3 attempts),
 * honouring the Retry-After header when present.
 */
const MAX_RETRIES = 3

export async function sfmcFetch(
  config: SfmcConfig,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken(config)
  const base = `https://${config.subdomain}.rest.marketingcloudapis.com`
  const url = `${base}${path}`
  const init: RequestInit = {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  }

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, init)

    if (res.status !== 429) return res

    if (attempt < MAX_RETRIES - 1) {
      const retryAfterSec = parseInt(res.headers.get('Retry-After') ?? '', 10)
      const delayMs =
        Number.isFinite(retryAfterSec) && retryAfterSec > 0
          ? retryAfterSec * 1000
          : Math.min(1_000 * 2 ** attempt, 30_000)
      const delaySec = Math.round(delayMs / 1000)
      process.stderr.write(
        `[mcp-sfmc] Rate limited (429). Waiting ${delaySec}s before retry ${attempt + 2}/${MAX_RETRIES}...\n`
      )
      await sleep(delayMs)
    }
  }

  // Exhausted retries — surface a clear rate-limit error
  throw new Error(
    `SFMC API rate limit exceeded after ${MAX_RETRIES} retries. ` +
    `Try again in a moment or reduce request frequency.`
  )
}

export async function sfmcGet<T>(config: SfmcConfig, path: string): Promise<T> {
  const res = await sfmcFetch(config, path)
  if (!res.ok) await throwSfmcError(res)
  return res.json() as Promise<T>
}

export async function sfmcPost<T>(config: SfmcConfig, path: string, body: unknown): Promise<T> {
  const res = await sfmcFetch(config, path, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwSfmcError(res)
  return res.json() as Promise<T>
}

export async function sfmcPatch<T>(config: SfmcConfig, path: string, body: unknown): Promise<T> {
  const res = await sfmcFetch(config, path, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!res.ok) await throwSfmcError(res)
  return res.json() as Promise<T>
}

/**
 * DELETE request — 404 is treated as success (already deleted).
 */
export async function sfmcDelete(config: SfmcConfig, path: string): Promise<void> {
  const res = await sfmcFetch(config, path, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) await throwSfmcError(res)
}

async function throwSfmcError(res: Response): Promise<never> {
  const err = await res.json().catch(() => ({})) as {
    message?: string
    error?: string
    error_description?: string
    errorcode?: number
  }
  const detail = err.message ?? err.error_description ?? err.error ?? `SFMC error ${res.status}`
  throw new Error(detail)
}
