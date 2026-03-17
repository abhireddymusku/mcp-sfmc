import { sfmcGet } from '../client.js'
import type { SfmcConfig } from '../types.js'

interface PushAppListResponse {
  items?: Array<{
    id: string
    name: string
    description?: string
    applicationType?: string
    status?: string
    createdDate?: string
    modifiedDate?: string
  }>
  count?: number
}

interface PushAppDetailResponse {
  id: string
  name: string
  description?: string
  applicationType?: string
  status?: string
  badge?: { type?: string }
  sound?: { type?: string }
  keys?: {
    apnsKey?: string
    gcmSenderId?: string
    [key: string]: unknown
  }
  openDirectSettings?: {
    defaultAction?: string
  }
  createdDate?: string
  modifiedDate?: string
}

interface PushMessageListResponse {
  items?: Array<{
    id: string
    name: string
    application?: { id?: string; name?: string }
    status?: string
    messageType?: string
    startDate?: string
    endDate?: string
    createdDate?: string
    modifiedDate?: string
    messagedSubscribersCount?: number
    totalOpens?: number
  }>
  count?: number
}

export interface PushApp {
  id: string
  name: string
  description?: string
  applicationType?: string
  status?: string
  createdDate?: string
  modifiedDate?: string
}

export interface PushAppDetail extends PushApp {
  badgeType?: string
  soundType?: string
  openDirectAction?: string
}

export interface PushMessage {
  id: string
  name: string
  appId?: string
  appName?: string
  status?: string
  messageType?: string
  startDate?: string
  endDate?: string
  sentCount?: number
  totalOpens?: number
  createdDate?: string
  modifiedDate?: string
}

/**
 * List push notification apps configured in the current BU.
 */
export async function listPushApps(
  config: SfmcConfig
): Promise<{ items: PushApp[]; total: number }> {
  const data = await sfmcGet<PushAppListResponse>(
    config,
    '/push/v1/application'
  )

  return {
    items: (data.items ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      applicationType: a.applicationType,
      status: a.status,
      createdDate: a.createdDate,
      modifiedDate: a.modifiedDate,
    })),
    total: data.count ?? 0,
  }
}

/**
 * Get full detail for a specific push app.
 */
export async function getPushApp(
  config: SfmcConfig,
  appId: string
): Promise<PushAppDetail | null> {
  const data = await sfmcGet<PushAppDetailResponse>(
    config,
    `/push/v1/application/${appId}`
  ).catch(() => null)

  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    applicationType: data.applicationType,
    status: data.status,
    badgeType: data.badge?.type,
    soundType: data.sound?.type,
    openDirectAction: data.openDirectSettings?.defaultAction,
    createdDate: data.createdDate,
    modifiedDate: data.modifiedDate,
  }
}

/**
 * List push messages (campaigns) for a specific push app.
 * Returns aggregate send counts — no individual device or subscriber data.
 */
export async function listPushMessages(
  config: SfmcConfig,
  appId: string,
  params: { page?: number; pageSize?: number } = {}
): Promise<{ items: PushMessage[]; total: number }> {
  const { page = 1, pageSize = 50 } = params

  const data = await sfmcGet<PushMessageListResponse>(
    config,
    `/push/v1/application/${appId}/message?$page=${page}&$pageSize=${pageSize}`
  )

  return {
    items: (data.items ?? []).map((m) => ({
      id: m.id,
      name: m.name,
      appId: m.application?.id,
      appName: m.application?.name,
      status: m.status,
      messageType: m.messageType,
      startDate: m.startDate,
      endDate: m.endDate,
      sentCount: m.messagedSubscribersCount,
      totalOpens: m.totalOpens,
      createdDate: m.createdDate,
      modifiedDate: m.modifiedDate,
    })),
    total: data.count ?? 0,
  }
}
