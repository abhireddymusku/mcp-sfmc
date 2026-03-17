import { sfmcGet } from '../client.js'
import type { SfmcConfig } from '../types.js'

interface DefinitionListResponse {
  definitions?: Array<{
    definitionKey: string
    definitionId?: string
    name: string
    status: string
    description?: string
    requestId?: string
    createdDate?: string
    modifiedDate?: string
    content?: { customerKey?: string }
    subscriptions?: {
      dataExtension?: string
      list?: string
      autoAddSubscriber?: boolean
      updateSubscriber?: boolean
    }
    options?: {
      trackLinks?: boolean
      cc?: string[]
      bcc?: string[]
    }
    fromEmail?: string
    fromName?: string
    subject?: string
  }>
  count?: number
  page?: number
  pageSize?: number
}

export interface TransactionalDefinition {
  key: string
  id?: string
  name: string
  status: string
  description?: string
  contentKey?: string
  fromEmail?: string
  fromName?: string
  subject?: string
  trackLinks?: boolean
  autoAddSubscriber?: boolean
  createdDate?: string
  modifiedDate?: string
}

/**
 * List transactional email send definitions.
 */
export async function listTransactionalDefinitions(
  config: SfmcConfig,
  params: { page?: number; pageSize?: number; status?: string } = {}
): Promise<{ items: TransactionalDefinition[]; total: number }> {
  const { page = 1, pageSize = 50, status } = params

  let url = `/messaging/v1/email/definitions?$page=${page}&$pageSize=${pageSize}`
  if (status) url += `&status=${encodeURIComponent(status)}`

  const data = await sfmcGet<DefinitionListResponse>(config, url)

  return {
    items: (data.definitions ?? []).map(mapDefinition),
    total: data.count ?? 0,
  }
}

/**
 * Get a single transactional email definition by key.
 */
export async function getTransactionalDefinition(
  config: SfmcConfig,
  definitionKey: string
): Promise<TransactionalDefinition | null> {
  interface SingleDefinitionResponse {
    definitionKey: string
    definitionId?: string
    name: string
    status: string
    description?: string
    content?: { customerKey?: string }
    subscriptions?: { autoAddSubscriber?: boolean; updateSubscriber?: boolean }
    options?: { trackLinks?: boolean }
    fromEmail?: string
    fromName?: string
    subject?: string
    createdDate?: string
    modifiedDate?: string
  }

  const data = await sfmcGet<SingleDefinitionResponse>(
    config,
    `/messaging/v1/email/definitions/${definitionKey}`
  ).catch(() => null)

  if (!data) return null
  return mapDefinition(data)
}

function mapDefinition(d: {
  definitionKey: string
  definitionId?: string
  name: string
  status: string
  description?: string
  content?: { customerKey?: string }
  subscriptions?: { autoAddSubscriber?: boolean }
  options?: { trackLinks?: boolean }
  fromEmail?: string
  fromName?: string
  subject?: string
  createdDate?: string
  modifiedDate?: string
}): TransactionalDefinition {
  return {
    key: d.definitionKey,
    id: d.definitionId,
    name: d.name,
    status: d.status,
    description: d.description,
    contentKey: d.content?.customerKey,
    fromEmail: d.fromEmail,
    fromName: d.fromName,
    subject: d.subject,
    trackLinks: d.options?.trackLinks,
    autoAddSubscriber: d.subscriptions?.autoAddSubscriber,
    createdDate: d.createdDate,
    modifiedDate: d.modifiedDate,
  }
}
