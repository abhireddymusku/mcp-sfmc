import { sfmcGet } from '../client.js'
import type { SfmcConfig } from '../types.js'

interface SeedListResponse {
  items?: Array<{
    id: string
    name: string
    description?: string
    addressCount?: number
    createdDate?: string
    modifiedDate?: string
  }>
  count?: number
}

export interface SeedList {
  id: string
  name: string
  description?: string
  addressCount?: number
  createdDate?: string
  modifiedDate?: string
}

/**
 * List all seed lists in the current BU.
 * Seed lists are used to send a copy of every email to a fixed set of addresses for QA.
 */
export async function listSeedLists(
  config: SfmcConfig
): Promise<{ items: SeedList[]; total: number }> {
  const data = await sfmcGet<SeedListResponse>(
    config,
    '/email/v1/seedlist/accounts'
  )

  return {
    items: (data.items ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      addressCount: s.addressCount,
      createdDate: s.createdDate,
      modifiedDate: s.modifiedDate,
    })),
    total: data.count ?? 0,
  }
}

/**
 * Get a single seed list by ID.
 * Returns metadata and address count — individual addresses are not returned to avoid PII exposure.
 */
export async function getSeedList(
  config: SfmcConfig,
  id: string
): Promise<SeedList | null> {
  interface SeedListDetailResponse {
    id: string
    name: string
    description?: string
    addressCount?: number
    createdDate?: string
    modifiedDate?: string
  }

  const data = await sfmcGet<SeedListDetailResponse>(
    config,
    `/email/v1/seedlist/accounts/${id}`
  ).catch(() => null)

  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    addressCount: data.addressCount,
    createdDate: data.createdDate,
    modifiedDate: data.modifiedDate,
  }
}
