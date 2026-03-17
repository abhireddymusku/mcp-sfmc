import { sfmcGet, sfmcPost } from '../client.js'
import type { SfmcConfig, SfmcContentAsset } from '../types.js'
import { resolveAssetHtml } from '../lib/html-resolver.js'

interface AssetQueryResponse {
  items?: SfmcContentAsset[]
  count?: number
  page?: number
  pageSize?: number
}

// ─── Tool implementations ─────────────────────────────────────────────────────

export interface ContentSearchResult {
  id: number
  name: string
  assetType: string
  folder?: string
  createdDate: string
  modifiedDate: string
}

export interface ContentDetail {
  id: number
  name: string
  assetType: string
  html: string
  subject?: string
  preheader?: string
  plainText?: string
  folder?: string
  createdDate: string
  modifiedDate: string
}

/**
 * Search Content Builder for HTML email assets.
 */
export async function searchContent(
  config: SfmcConfig,
  params: { query?: string; page?: number; pageSize?: number }
): Promise<{ items: ContentSearchResult[]; total: number; page: number }> {
  const { query, page = 1, pageSize = 20 } = params

  type TypeQuery = {
    property: string
    simpleOperator: string
    value: string | string[]
  }

  const typeQuery: TypeQuery = {
    property: 'assetType.name',
    simpleOperator: 'in',
    value: ['templatebasedemail', 'htmlemail'],
  }

  const queryBody = query?.trim()
    ? {
        query: {
          leftOperand: typeQuery,
          logicalOperator: 'AND',
          rightOperand: {
            property: 'name',
            simpleOperator: 'contains',
            value: query.trim(),
          },
        },
        fields: ['id', 'name', 'assetType', 'category', 'createdDate', 'modifiedDate'],
        page: { page, pageSize },
      }
    : {
        query: typeQuery,
        fields: ['id', 'name', 'assetType', 'category', 'createdDate', 'modifiedDate'],
        page: { page, pageSize },
      }

  const data = await sfmcPost<AssetQueryResponse>(
    config,
    '/asset/v1/content/assets/query',
    queryBody
  )

  return {
    items: (data.items ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      assetType: a.assetType.name,
      folder: a.category?.name,
      createdDate: a.createdDate,
      modifiedDate: a.modifiedDate,
    })),
    total: data.count ?? 0,
    page: data.page ?? page,
  }
}

/**
 * Fetch full HTML content for a Content Builder email asset by ID.
 */
export async function getContentById(
  config: SfmcConfig,
  assetId: number
): Promise<ContentDetail> {
  const asset = await sfmcGet<SfmcContentAsset>(
    config,
    `/asset/v1/content/assets/${assetId}`
  )
  return assetToDetail(asset)
}

/**
 * Fetch full HTML content by asset name (exact match, first result).
 */
export async function getContentByName(
  config: SfmcConfig,
  name: string
): Promise<ContentDetail | null> {
  const data = await sfmcPost<AssetQueryResponse>(
    config,
    '/asset/v1/content/assets/query',
    {
      query: {
        leftOperand: {
          property: 'assetType.name',
          simpleOperator: 'in',
          value: ['templatebasedemail', 'htmlemail'],
        },
        logicalOperator: 'AND',
        rightOperand: {
          property: 'name',
          simpleOperator: 'equals',
          value: name,
        },
      },
      fields: ['id', 'name', 'assetType', 'views', 'content', 'category'],
      page: { page: 1, pageSize: 5 },
    }
  )

  const match = data.items?.[0]
  if (!match) return null

  // Fetch full asset for complete slot resolution
  return getContentById(config, match.id)
}

/**
 * List Content Builder folders.
 */
export async function listFolders(
  config: SfmcConfig
): Promise<Array<{ id: number; name: string; parentId: number }>> {
  interface FolderResponse {
    items?: Array<{ id: number; name: string; parentId: number }>
    count?: number
  }

  const data = await sfmcGet<FolderResponse>(
    config,
    '/asset/v1/content/categories?$pageSize=200'
  )

  return (data.items ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    parentId: f.parentId,
  }))
}

/**
 * Get a specific Content Builder folder by ID.
 */
export async function getFolder(
  config: SfmcConfig,
  folderId: number
): Promise<{ id: number; name: string; parentId: number } | null> {
  interface FolderDetailResponse {
    id: number
    name: string
    parentId: number
  }

  const data = await sfmcGet<FolderDetailResponse>(
    config,
    `/asset/v1/content/categories/${folderId}`
  ).catch(() => null)

  if (!data) return null
  return { id: data.id, name: data.name, parentId: data.parentId }
}

/**
 * List email assets within a specific Content Builder folder.
 */
export async function listContentByFolder(
  config: SfmcConfig,
  params: { folderId: number; page?: number; pageSize?: number }
): Promise<{ items: ContentSearchResult[]; total: number; page: number }> {
  const { folderId, page = 1, pageSize = 20 } = params

  const data = await sfmcPost<AssetQueryResponse>(
    config,
    '/asset/v1/content/assets/query',
    {
      query: {
        leftOperand: {
          property: 'assetType.name',
          simpleOperator: 'in',
          value: ['templatebasedemail', 'htmlemail'],
        },
        logicalOperator: 'AND',
        rightOperand: {
          property: 'category.id',
          simpleOperator: 'equals',
          value: String(folderId),
        },
      },
      fields: ['id', 'name', 'assetType', 'category', 'createdDate', 'modifiedDate'],
      page: { page, pageSize },
    }
  )

  return {
    items: (data.items ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      assetType: a.assetType.name,
      folder: a.category?.name,
      createdDate: a.createdDate,
      modifiedDate: a.modifiedDate,
    })),
    total: data.count ?? 0,
    page: data.page ?? page,
  }
}

// ─── Internal helper ──────────────────────────────────────────────────────────

function assetToDetail(asset: SfmcContentAsset): ContentDetail {
  return {
    id: asset.id,
    name: asset.name,
    assetType: asset.assetType.name,
    html: resolveAssetHtml(asset),
    subject: asset.views?.subjectline?.content,
    preheader: asset.views?.preheader?.content,
    plainText: asset.views?.text?.content,
    folder: asset.category?.name,
    createdDate: asset.createdDate,
    modifiedDate: asset.modifiedDate,
  }
}
