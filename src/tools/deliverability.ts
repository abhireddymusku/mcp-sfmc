import { sfmcGet } from '../client.js'
import type { SfmcConfig } from '../types.js'

interface DomainResponse {
  items?: Array<{
    id?: string
    domain?: string
    name?: string
    status?: string
    dkimStatus?: string
    spfStatus?: string
    verified?: boolean
    createdDate?: string
    modifiedDate?: string
  }>
  count?: number
}

interface SuppressionListResponse {
  items?: Array<{
    id: string
    name: string
    description?: string
    type?: string
    size?: number
    addressCount?: number
    createdDate?: string
    modifiedDate?: string
  }>
  count?: number
}

export interface SenderDomain {
  id?: string
  domain: string
  status?: string
  dkimStatus?: string
  spfStatus?: string
  verified?: boolean
  createdDate?: string
  modifiedDate?: string
}

export interface SuppressionList {
  id: string
  name: string
  description?: string
  type?: string
  addressCount?: number
  createdDate?: string
  modifiedDate?: string
}

/**
 * List authenticated sender domains (SAP / Private Domain) configured in this account.
 * Shows DKIM and SPF verification status — useful for diagnosing deliverability.
 */
export async function listSenderDomains(
  config: SfmcConfig
): Promise<{ items: SenderDomain[]; total: number }> {
  const data = await sfmcGet<DomainResponse>(
    config,
    '/email/v1/domains'
  )

  return {
    items: (data.items ?? []).map((d) => ({
      id: d.id,
      domain: d.domain ?? d.name ?? '',
      status: d.status,
      dkimStatus: d.dkimStatus,
      spfStatus: d.spfStatus,
      verified: d.verified,
      createdDate: d.createdDate,
      modifiedDate: d.modifiedDate,
    })),
    total: data.count ?? 0,
  }
}

/**
 * List suppression lists in the current BU.
 * Returns metadata and address counts only — individual suppressed addresses are not returned.
 */
export async function listSuppressionLists(
  config: SfmcConfig
): Promise<{ items: SuppressionList[]; total: number }> {
  const data = await sfmcGet<SuppressionListResponse>(
    config,
    '/email/v1/suppressionlists'
  )

  return {
    items: (data.items ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      type: s.type,
      addressCount: s.addressCount ?? s.size,
      createdDate: s.createdDate,
      modifiedDate: s.modifiedDate,
    })),
    total: data.count ?? 0,
  }
}

/**
 * Get a single suppression list by ID.
 * Returns metadata and address count only — no individual addresses returned.
 */
export async function getSuppressionList(
  config: SfmcConfig,
  id: string
): Promise<SuppressionList | null> {
  interface SuppressionDetailResponse {
    id: string
    name: string
    description?: string
    type?: string
    size?: number
    addressCount?: number
    createdDate?: string
    modifiedDate?: string
  }

  const data = await sfmcGet<SuppressionDetailResponse>(
    config,
    `/email/v1/suppressionlists/${id}`
  ).catch(() => null)

  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    type: data.type,
    addressCount: data.addressCount ?? data.size,
    createdDate: data.createdDate,
    modifiedDate: data.modifiedDate,
  }
}
