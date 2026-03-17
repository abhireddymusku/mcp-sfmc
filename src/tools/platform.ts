import { sfmcGet } from '../client.js'
import type { SfmcConfig } from '../types.js'

interface EndpointsResponse {
  items?: Array<{
    name?: string
    url?: string
    description?: string
    methods?: string[]
    category?: string
  }>
  urls?: Array<{
    name: string
    url: string
  }>
  count?: number
}

interface AuditEventResponse {
  items?: Array<{
    id?: string
    changedObjectId?: string
    changedObjectType?: string
    changedObjectValue?: string
    changedValue?: string
    operationType?: string
    userId?: string
    userName?: string
    correlationId?: string
    changeType?: string
    changeDescription?: string
    createdDate?: string
  }>
  count?: number
  page?: number
  pageSize?: number
}

export interface ApiEndpoint {
  name?: string
  url: string
  description?: string
  methods?: string[]
  category?: string
}

export interface AuditEvent {
  id?: string
  objectType?: string
  objectId?: string
  operation?: string
  changeType?: string
  description?: string
  userId?: string
  userName?: string
  createdDate?: string
}

/**
 * Get all REST API endpoints available for this SFMC account.
 * Useful for understanding which API capabilities are enabled for this edition.
 */
export async function getApiEndpoints(
  config: SfmcConfig
): Promise<{ items: ApiEndpoint[] }> {
  const data = await sfmcGet<EndpointsResponse>(
    config,
    '/platform/v1/endpoints'
  ).catch((): EndpointsResponse => ({}))

  const rawItems = data.items ?? data.urls ?? []

  const mapped: ApiEndpoint[] = []
  for (const e of rawItems) {
    const url = 'url' in e ? e.url : undefined
    if (url) {
      mapped.push({
        name: e.name,
        url,
        description: 'description' in e ? e.description : undefined,
        methods: 'methods' in e ? e.methods : undefined,
        category: 'category' in e ? e.category : undefined,
      })
    }
  }
  return { items: mapped }
}

/**
 * Get recent audit events — who changed what and when in this SFMC account.
 * Useful for security reviews and debugging unexpected configuration changes.
 */
export async function getAuditLog(
  config: SfmcConfig,
  params: { page?: number; pageSize?: number; objectType?: string } = {}
): Promise<{ items: AuditEvent[]; total: number }> {
  const { page = 1, pageSize = 50, objectType } = params

  let url = `/audit/v1/auditEvents?$page=${page}&$pageSize=${pageSize}&$orderBy=createdDate%20DESC`
  if (objectType) url += `&$filter=changedObjectType%20eq%20'${encodeURIComponent(objectType)}'`

  const data = await sfmcGet<AuditEventResponse>(config, url)

  return {
    items: (data.items ?? []).map((e) => ({
      id: e.id,
      objectType: e.changedObjectType,
      objectId: e.changedObjectId,
      operation: e.operationType,
      changeType: e.changeType,
      description: e.changeDescription ?? e.changedValue,
      userId: e.userId,
      userName: e.userName,
      createdDate: e.createdDate,
    })),
    total: data.count ?? 0,
  }
}
