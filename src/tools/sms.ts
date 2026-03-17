import { sfmcGet } from '../client.js'
import type { SfmcConfig } from '../types.js'

interface SmsDefinitionResponse {
  definitions?: Array<{
    definitionKey: string
    name: string
    status?: string
    description?: string
    content?: { message?: string }
    subscriptions?: { shortCode?: string; keyword?: string; countryCode?: string }
    createdDate?: string
    modifiedDate?: string
  }>
  count?: number
  page?: number
  pageSize?: number
}

interface SmsKeywordResponse {
  items?: Array<{
    id?: string
    keyword: string
    shortCode?: string
    countryCode?: string
    response?: string
    status?: string
    createdDate?: string
    modifiedDate?: string
  }>
  count?: number
}

export interface SmsDefinition {
  key: string
  name: string
  status?: string
  description?: string
  messageTemplate?: string
  shortCode?: string
  keyword?: string
  countryCode?: string
  createdDate?: string
  modifiedDate?: string
}

export interface SmsKeyword {
  id?: string
  keyword: string
  shortCode?: string
  countryCode?: string
  response?: string
  status?: string
  createdDate?: string
  modifiedDate?: string
}

/**
 * List SMS send definitions in the current BU.
 */
export async function listSmsDefinitions(
  config: SfmcConfig,
  params: { page?: number; pageSize?: number; status?: string } = {}
): Promise<{ items: SmsDefinition[]; total: number }> {
  const { page = 1, pageSize = 50, status } = params

  let url = `/messaging/v1/sms/definitions?$page=${page}&$pageSize=${pageSize}`
  if (status) url += `&status=${encodeURIComponent(status)}`

  const data = await sfmcGet<SmsDefinitionResponse>(config, url)

  return {
    items: (data.definitions ?? []).map((d) => ({
      key: d.definitionKey,
      name: d.name,
      status: d.status,
      description: d.description,
      messageTemplate: d.content?.message,
      shortCode: d.subscriptions?.shortCode,
      keyword: d.subscriptions?.keyword,
      countryCode: d.subscriptions?.countryCode,
      createdDate: d.createdDate,
      modifiedDate: d.modifiedDate,
    })),
    total: data.count ?? 0,
  }
}

/**
 * Get a single SMS definition by key.
 */
export async function getSmsDefinition(
  config: SfmcConfig,
  definitionKey: string
): Promise<SmsDefinition | null> {
  interface SingleSmsResponse {
    definitionKey: string
    name: string
    status?: string
    description?: string
    content?: { message?: string }
    subscriptions?: { shortCode?: string; keyword?: string; countryCode?: string }
    createdDate?: string
    modifiedDate?: string
  }

  const data = await sfmcGet<SingleSmsResponse>(
    config,
    `/messaging/v1/sms/definitions/${definitionKey}`
  ).catch(() => null)

  if (!data) return null

  return {
    key: data.definitionKey,
    name: data.name,
    status: data.status,
    description: data.description,
    messageTemplate: data.content?.message,
    shortCode: data.subscriptions?.shortCode,
    keyword: data.subscriptions?.keyword,
    countryCode: data.subscriptions?.countryCode,
    createdDate: data.createdDate,
    modifiedDate: data.modifiedDate,
  }
}

/**
 * List SMS opt-in keywords configured in the current BU.
 */
export async function listSmsKeywords(
  config: SfmcConfig
): Promise<{ items: SmsKeyword[]; total: number }> {
  const data = await sfmcGet<SmsKeywordResponse>(
    config,
    '/messaging/v1/sms/keywords'
  )

  return {
    items: (data.items ?? []).map((k) => ({
      id: k.id,
      keyword: k.keyword,
      shortCode: k.shortCode,
      countryCode: k.countryCode,
      response: k.response,
      status: k.status,
      createdDate: k.createdDate,
      modifiedDate: k.modifiedDate,
    })),
    total: data.count ?? 0,
  }
}
