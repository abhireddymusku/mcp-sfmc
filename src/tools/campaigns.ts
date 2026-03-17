import { sfmcGet } from '../client.js'
import type { SfmcConfig } from '../types.js'

interface CampaignListResponse {
  items?: Array<{
    id: string
    name: string
    description?: string
    campaignCode?: string
    color?: string
    favorite?: boolean
    createdDate?: string
    modifiedDate?: string
  }>
  count?: number
  page?: number
  pageSize?: number
}

interface CampaignAssetResponse {
  items?: Array<{
    id: string
    type: string
    itemId?: string
    itemKey?: string
    name?: string
    createdDate?: string
  }>
  count?: number
}

export interface CampaignSummary {
  id: string
  name: string
  description?: string
  campaignCode?: string
  color?: string
  favorite?: boolean
  createdDate?: string
  modifiedDate?: string
}

export interface CampaignAsset {
  id: string
  type: string
  itemId?: string
  itemKey?: string
  name?: string
  createdDate?: string
}

/**
 * List campaigns in the current BU.
 */
export async function listCampaigns(
  config: SfmcConfig,
  params: { page?: number; pageSize?: number; search?: string } = {}
): Promise<{ items: CampaignSummary[]; total: number }> {
  const { page = 1, pageSize = 50 } = params

  let url = `/campaign/v1/campaigns?$page=${page}&$pageSize=${pageSize}`
  if (params.search?.trim()) {
    url += `&$filter=name%20like%20'${encodeURIComponent(params.search.trim())}'`
  }

  const data = await sfmcGet<CampaignListResponse>(config, url)

  return {
    items: (data.items ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      campaignCode: c.campaignCode,
      color: c.color,
      favorite: c.favorite,
      createdDate: c.createdDate,
      modifiedDate: c.modifiedDate,
    })),
    total: data.count ?? 0,
  }
}

/**
 * Get a single campaign by ID.
 */
export async function getCampaign(
  config: SfmcConfig,
  campaignId: string
): Promise<CampaignSummary | null> {
  interface CampaignDetailResponse {
    id: string
    name: string
    description?: string
    campaignCode?: string
    color?: string
    favorite?: boolean
    createdDate?: string
    modifiedDate?: string
  }

  const data = await sfmcGet<CampaignDetailResponse>(
    config,
    `/campaign/v1/campaigns/${campaignId}`
  ).catch(() => null)

  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    campaignCode: data.campaignCode,
    color: data.color,
    favorite: data.favorite,
    createdDate: data.createdDate,
    modifiedDate: data.modifiedDate,
  }
}

/**
 * Get all assets (emails, automations, journeys) linked to a campaign.
 */
export async function getCampaignAssets(
  config: SfmcConfig,
  campaignId: string
): Promise<{ items: CampaignAsset[]; total: number }> {
  const data = await sfmcGet<CampaignAssetResponse>(
    config,
    `/campaign/v1/campaigns/${campaignId}/assets`
  )

  return {
    items: (data.items ?? []).map((a) => ({
      id: a.id,
      type: a.type,
      itemId: a.itemId,
      itemKey: a.itemKey,
      name: a.name,
      createdDate: a.createdDate,
    })),
    total: data.count ?? 0,
  }
}
