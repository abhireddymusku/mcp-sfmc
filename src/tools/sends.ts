import { sfmcGet } from '../client.js'
import type { SfmcConfig } from '../types.js'

interface SendDefinitionResponse {
  items?: Array<{
    id: string
    name: string
    status: string
    definitionType: string
    requestId?: string
    scheduledTime?: string
    stats?: {
      requested?: number
      sent?: number
      delivered?: number
      bounced?: number
      opened?: number
      clicked?: number
      optedOut?: number
    }
    createdDate?: string
    modifiedDate?: string
  }>
  count?: number
}

interface TrackingResponse {
  items?: Array<Record<string, string | number>>
  count?: number
}

/**
 * List recent email sends (Message Definition Sends).
 */
export async function listSends(
  config: SfmcConfig,
  params: { status?: string; page?: number; pageSize?: number } = {}
): Promise<Array<{
  id: string
  name: string
  status: string
  definitionType: string
  scheduled?: string
  stats?: {
    requested?: number
    sent?: number
    delivered?: number
    bounced?: number
    opened?: number
    clicked?: number
    optedOut?: number
  }
  createdDate?: string
  modifiedDate?: string
}>> {
  const { page = 1, pageSize = 25 } = params
  let url = `/messaging/v1/messageDefinitionSends/?$page=${page}&$pageSize=${pageSize}&$orderBy=createdDate%20DESC`
  if (params.status) {
    url += `&$filter=status%20eq%20'${encodeURIComponent(params.status)}'`
  }

  const data = await sfmcGet<SendDefinitionResponse>(config, url)

  return (data.items ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    definitionType: s.definitionType,
    scheduled: s.scheduledTime,
    stats: s.stats,
    createdDate: s.createdDate,
    modifiedDate: s.modifiedDate,
  }))
}

/**
 * Get send performance metrics for a specific send definition.
 */
export async function getSendPerformance(
  config: SfmcConfig,
  sendId: string
): Promise<{
  id: string
  name: string
  status: string
  stats: {
    requested?: number
    sent?: number
    delivered?: number
    bounced?: number
    opened?: number
    clicked?: number
    optedOut?: number
    openRate?: string
    clickRate?: string
    bounceRate?: string
  }
} | null> {
  interface SendDetailResponse {
    id: string
    name: string
    status: string
    stats?: {
      requested?: number
      sent?: number
      delivered?: number
      bounced?: number
      opened?: number
      clicked?: number
      optedOut?: number
    }
  }

  const data = await sfmcGet<SendDetailResponse>(
    config,
    `/messaging/v1/messageDefinitionSends/${sendId}`
  ).catch(() => null)

  if (!data) return null

  const stats = data.stats ?? {}
  const delivered = stats.delivered ?? 0
  const openRate = delivered > 0 ? `${((stats.opened ?? 0) / delivered * 100).toFixed(1)}%` : undefined
  const clickRate = delivered > 0 ? `${((stats.clicked ?? 0) / delivered * 100).toFixed(1)}%` : undefined
  const bounceRate = delivered > 0 ? `${((stats.bounced ?? 0) / delivered * 100).toFixed(1)}%` : undefined

  return {
    id: data.id,
    name: data.name,
    status: data.status,
    stats: {
      ...stats,
      openRate,
      clickRate,
      bounceRate,
    },
  }
}

/**
 * Get tracking summary for an email send using Data Views (open/click/bounce/unsub).
 * Queries the _Sent, _Open, _Click, _Bounce tracking data views via REST.
 * Note: requires Data Views access in the connected BU.
 */
export async function getTrackingSummary(
  config: SfmcConfig,
  jobId: string
): Promise<{
  sent: number
  opens: number
  uniqueOpens: number
  clicks: number
  uniqueClicks: number
  bounces: number
  unsubscribes: number
  openRate: string
  clickRate: string
  bounceRate: string
} | null> {
  // Query _Sent view for total sends
  const sentUrl = `/data/v1/customobjectdata/key/_Sent/rowset?$filter=JobID%20eq%20${jobId}&$pageSize=1`
  // Query _Open view for opens
  const openUrl = `/data/v1/customobjectdata/key/_Open/rowset?$filter=JobID%20eq%20${jobId}&$pageSize=1`
  // Query _Click for clicks
  const clickUrl = `/data/v1/customobjectdata/key/_Click/rowset?$filter=JobID%20eq%20${jobId}&$pageSize=1`
  // Query _Bounce for bounces
  const bounceUrl = `/data/v1/customobjectdata/key/_Bounce/rowset?$filter=JobID%20eq%20${jobId}&$pageSize=1`
  // Query _Unsubscribe for unsubs
  const unsubUrl = `/data/v1/customobjectdata/key/_Unsubscribe/rowset?$filter=JobID%20eq%20${jobId}&$pageSize=1`

  const [sent, opened, clicked, bounced, unsubbed] = await Promise.all([
    sfmcGet<TrackingResponse>(config, sentUrl).catch(() => ({ count: 0 })),
    sfmcGet<TrackingResponse>(config, openUrl).catch(() => ({ count: 0 })),
    sfmcGet<TrackingResponse>(config, clickUrl).catch(() => ({ count: 0 })),
    sfmcGet<TrackingResponse>(config, bounceUrl).catch(() => ({ count: 0 })),
    sfmcGet<TrackingResponse>(config, unsubUrl).catch(() => ({ count: 0 })),
  ])

  const sentCount = sent.count ?? 0
  const openCount = opened.count ?? 0
  const clickCount = clicked.count ?? 0
  const bounceCount = bounced.count ?? 0
  const unsubCount = unsubbed.count ?? 0

  if (sentCount === 0) return null

  return {
    sent: sentCount,
    opens: openCount,
    uniqueOpens: openCount, // Data Views count is unique by default
    clicks: clickCount,
    uniqueClicks: clickCount,
    bounces: bounceCount,
    unsubscribes: unsubCount,
    openRate: `${(openCount / sentCount * 100).toFixed(1)}%`,
    clickRate: `${(clickCount / sentCount * 100).toFixed(1)}%`,
    bounceRate: `${(bounceCount / sentCount * 100).toFixed(1)}%`,
  }
}
