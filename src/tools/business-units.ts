import { getToken } from '../client.js'
import type { SfmcConfig, SfmcBusinessUnit } from '../types.js'

interface AccountsResponse {
  items?: Array<{ id: number; name: string; parentId?: number; parentMid?: number }>
}

/**
 * List all child business units accessible from the parent BU.
 */
export async function listBusinessUnits(config: SfmcConfig): Promise<SfmcBusinessUnit[]> {
  // Must use parent MID token to see all child BUs
  const parentConfig = { ...config, mid: undefined }
  const token = await getToken(parentConfig)

  const res = await fetch(
    `https://${config.subdomain}.rest.marketingcloudapis.com/platform/v1/accounts`,
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  )

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string }
    throw new Error(err.message ?? `Failed to list business units (${res.status})`)
  }

  const data = await res.json() as AccountsResponse
  const parentMidNum = config.mid ? parseInt(config.mid, 10) : 0

  return (data.items ?? [])
    .filter((item) => item.id !== parentMidNum)
    .map((item) => ({
      id: item.id,
      name: item.name,
      parentId: item.parentId ?? item.parentMid ?? parentMidNum,
    }))
}
