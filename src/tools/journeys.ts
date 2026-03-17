import { sfmcGet } from '../client.js'
import type { SfmcConfig, SfmcJourney, SfmcActivity, ActivitySequenceItem } from '../types.js'

interface InteractionsResponse {
  items?: SfmcJourney[]
  count?: number
  page?: number
  pageSize?: number
}

// ─── Tool implementations ─────────────────────────────────────────────────────

export interface JourneySummary {
  id: string
  key: string
  name: string
  description?: string
  version: number
  status: string
  currentPopulation?: number
  cumulativePopulation?: number
  emailActivityCount: number
  createdDate: string
  modifiedDate: string
}

export interface JourneyDetail {
  id: string
  key: string
  name: string
  description?: string
  version: number
  status: string
  stats?: { currentPopulation?: number; cumulativePopulation?: number }
  sequence: ActivitySequenceItem[]
  emailActivities: Array<{
    activityId: string
    activityKey: string
    name: string
    emailAssetId?: number
  }>
  allActivities: Array<{ id: string; key: string; name: string; type: string }>
  createdDate: string
  modifiedDate: string
}

/**
 * List journeys filtered by status and optional name search.
 * @param status  'Running' | 'Draft' | 'Stopped' | 'Paused' — default 'Running'
 * @param search  Optional name filter (LIKE match)
 */
export async function listJourneys(
  config: SfmcConfig,
  params: { status?: string; search?: string; page?: number; pageSize?: number } = {}
): Promise<{ items: JourneySummary[]; total: number }> {
  const status = params.status ?? 'Running'
  const page = params.page ?? 1
  const pageSize = Math.min(params.pageSize ?? 50, 200)

  const filterParts = [`status eq ${encodeURIComponent(status)}`]
  if (params.search?.trim()) {
    filterParts.push(`name like '${encodeURIComponent(params.search.trim())}'`)
  }
  const filter = filterParts.join('%20AND%20')

  const data = await sfmcGet<InteractionsResponse>(
    config,
    `/interaction/v1/interactions?$filter=${filter}&$page=${page}&$pageSize=${pageSize}`
  )

  const items = (data.items ?? []).map((j) => ({
    id: j.id,
    key: j.key,
    name: j.name,
    description: j.description,
    version: j.version,
    status: j.status,
    currentPopulation: j.stats?.currentPopulation,
    cumulativePopulation: j.stats?.cumulativePopulation,
    emailActivityCount: j.activities.filter((a) => a.type === 'EMAILV2').length,
    createdDate: j.createdDate,
    modifiedDate: j.modifiedDate,
  }))

  return { items, total: data.count ?? items.length }
}

/**
 * Get full journey detail including resolved activity sequence and email asset IDs.
 */
export async function getJourney(
  config: SfmcConfig,
  journeyId: string,
  version?: number
): Promise<JourneyDetail> {
  const versionParam = version ? `?versionNumber=${version}` : ''
  const journey = await sfmcGet<SfmcJourney>(
    config,
    `/interaction/v1/interactions/${journeyId}${versionParam}`
  )

  const emailActivities = journey.activities
    .filter((a) => a.type === 'EMAILV2')
    .map((a) => ({
      activityId: a.id,
      activityKey: a.key,
      name: a.name,
      emailAssetId: resolveEmailAssetId(a),
    }))

  return {
    id: journey.id,
    key: journey.key,
    name: journey.name,
    description: journey.description,
    version: journey.version,
    status: journey.status,
    stats: journey.stats,
    sequence: buildActivitySequence(journey),
    emailActivities,
    allActivities: journey.activities.map((a) => ({
      id: a.id,
      key: a.key,
      name: a.name,
      type: a.type,
    })),
    createdDate: journey.createdDate,
    modifiedDate: journey.modifiedDate,
  }
}

/**
 * Get per-activity send statistics for a specific journey version.
 * Uses the Journey Builder Interactions statistics endpoint.
 */
export async function getJourneyStats(
  config: SfmcConfig,
  journeyId: string,
  version: number
): Promise<Array<{
  activityKey: string
  activityName: string
  activityType: string
  sent?: number
  delivered?: number
  opened?: number
  clicked?: number
  optedOut?: number
  bounced?: number
  openRate?: string
  clickRate?: string
  bounceRate?: string
}>> {
  interface StatsResponse {
    activities?: Array<{
      key: string
      name: string
      type: string
      metaData?: {
        metrics?: {
          sent?: number
          delivered?: number
          opens?: number
          clicks?: number
          optOuts?: number
          bounces?: number
        }
      }
    }>
  }

  const data = await sfmcGet<StatsResponse>(
    config,
    `/interaction/v1/interactions/${journeyId}/version/${version}/activities`
  ).catch(() => ({ activities: [] as StatsResponse['activities'] }))

  return (data.activities ?? []).map((a) => {
    const m = a.metaData?.metrics ?? {}
    const delivered = m.delivered ?? 0
    return {
      activityKey: a.key,
      activityName: a.name,
      activityType: a.type,
      sent: m.sent,
      delivered: m.delivered,
      opened: m.opens,
      clicked: m.clicks,
      optedOut: m.optOuts,
      bounced: m.bounces,
      openRate: delivered > 0 ? `${((m.opens ?? 0) / delivered * 100).toFixed(1)}%` : undefined,
      clickRate: delivered > 0 ? `${((m.clicks ?? 0) / delivered * 100).toFixed(1)}%` : undefined,
      bounceRate: delivered > 0 ? `${((m.bounces ?? 0) / delivered * 100).toFixed(1)}%` : undefined,
    }
  })
}

// ─── Journey diff ─────────────────────────────────────────────────────────────

export interface JourneyDiff {
  journeyId: string
  fromVersion: number
  toVersion: number
  activitiesAdded: Array<{ key: string; name: string; type: string }>
  activitiesRemoved: Array<{ key: string; name: string; type: string }>
  activitiesChanged: Array<{ key: string; name: string; type: string; changes: string[] }>
  sequenceChanged: boolean
  summary: string
}

export async function diffJourneyVersions(
  config: SfmcConfig,
  journeyId: string,
  fromVersion: number,
  toVersion: number,
): Promise<JourneyDiff> {
  const [v1, v2] = await Promise.all([
    getJourney(config, journeyId, fromVersion),
    getJourney(config, journeyId, toVersion),
  ])

  const v1Map = new Map(v1.allActivities.map(a => [a.key, a]))
  const v2Map = new Map(v2.allActivities.map(a => [a.key, a]))

  const activitiesAdded = v2.allActivities.filter(a => !v1Map.has(a.key))
  const activitiesRemoved = v1.allActivities.filter(a => !v2Map.has(a.key))

  const activitiesChanged: JourneyDiff['activitiesChanged'] = []
  for (const a1 of v1.allActivities) {
    const a2 = v2Map.get(a1.key)
    if (!a2) continue
    const changes: string[] = []
    if (a1.name !== a2.name) changes.push(`name: "${a1.name}" → "${a2.name}"`)
    // Check email asset changes via emailActivities
    const e1 = v1.emailActivities.find(e => e.activityKey === a1.key)
    const e2 = v2.emailActivities.find(e => e.activityKey === a2.key)
    if (e1 && e2 && e1.emailAssetId !== e2.emailAssetId) {
      changes.push(`emailAssetId: ${e1.emailAssetId} → ${e2.emailAssetId}`)
    }
    if (changes.length > 0) activitiesChanged.push({ key: a1.key, name: a1.name, type: a1.type, changes })
  }

  const v1Sequence = v1.sequence.map(s => s.activityKey)
  const v2Sequence = v2.sequence.map(s => s.activityKey)
  const sequenceChanged = JSON.stringify(v1Sequence) !== JSON.stringify(v2Sequence)

  const parts: string[] = []
  if (activitiesAdded.length) parts.push(`${activitiesAdded.length} added`)
  if (activitiesRemoved.length) parts.push(`${activitiesRemoved.length} removed`)
  if (activitiesChanged.length) parts.push(`${activitiesChanged.length} changed`)
  if (sequenceChanged) parts.push('sequence reordered')
  const summary = parts.length
    ? `v${fromVersion}→v${toVersion}: ${parts.join(', ')}`
    : `No differences between v${fromVersion} and v${toVersion}`

  return { journeyId, fromVersion, toVersion, activitiesAdded, activitiesRemoved, activitiesChanged, sequenceChanged, summary }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resolveEmailAssetId(activity: SfmcActivity): number | undefined {
  const c = activity.configurationArguments
  if (!c) return undefined
  return c.contentBuilder?.emailId ?? c.emailId ?? undefined
}

function buildActivitySequence(journey: SfmcJourney): ActivitySequenceItem[] {
  const activities = journey.activities
  if (!activities || activities.length === 0) return []

  const byKey = new Map<string, SfmcActivity>()
  for (const a of activities) byKey.set(a.key, a)

  const referencedKeys = new Set<string>()
  for (const a of activities) {
    for (const o of a.outcomes ?? []) {
      if (o.next) referencedKeys.add(o.next)
    }
  }

  const nonTrigger = activities.filter(
    (a) => !a.type.toLowerCase().includes('trigger') && !a.type.toLowerCase().includes('entry')
  )
  let current: SfmcActivity | undefined = nonTrigger.find((a) => !referencedKeys.has(a.key))
  if (!current) current = activities[0]
  if (!current) return []

  const sequence: ActivitySequenceItem[] = []
  const visited = new Set<string>()

  while (current && !visited.has(current.key)) {
    visited.add(current.key)
    const item = toSequenceItem(current)
    sequence.push(item)

    const outcomes = current.outcomes ?? []
    if (outcomes.length === 0) break
    if (outcomes.length > 1) {
      item.branchNote = `+ ${outcomes.length - 1} other ${outcomes.length - 1 === 1 ? 'branch' : 'branches'}`
    }

    const nextKey = outcomes[0]?.next
    if (!nextKey) break
    current = byKey.get(nextKey)
  }

  return sequence
}

function toSequenceItem(activity: SfmcActivity): ActivitySequenceItem {
  const base = { activityKey: activity.key, activityId: activity.id }
  const type = activity.type.toUpperCase()

  if (type === 'EMAILV2') {
    return { ...base, type: 'email', label: activity.name, emailAssetId: resolveEmailAssetId(activity) }
  }
  if (type.startsWith('WAIT')) {
    return { ...base, type: 'wait', label: 'Wait' }
  }
  if (type.includes('SPLIT')) {
    return { ...base, type: 'split', label: `[${activity.type}]` }
  }
  if (type.includes('JOIN')) {
    return { ...base, type: 'join', label: '[Join]' }
  }
  return { ...base, type: 'other', label: `[${activity.type}]` }
}
