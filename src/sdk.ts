/**
 * mcp-sfmc SDK — use SFMC tools directly in Node.js without an MCP client or LLM.
 *
 * @example
 * ```typescript
 * import { createClient } from 'mcp-sfmc/sdk'
 *
 * const sfmc = createClient({
 *   subdomain: 'mc563885gzs27c5t9',
 *   clientId: 'your-client-id',
 *   clientSecret: 'your-client-secret',
 *   mid: 'optional-child-bu-mid',
 * })
 *
 * const journeys = await sfmc.listJourneys({ status: 'Running' })
 * const html = await sfmc.getContentByName('Welcome Email')
 * ```
 */

import type { SfmcConfig } from './types.js'
import { TtlCache } from './lib/cache.js'
import { traced, type Tracer, type Span } from './lib/otel.js'
import { paginate } from './lib/paginate.js'

// ── Tool imports ──────────────────────────────────────────────────────────────
import {
  searchContent,
  getContentById,
  getContentByName,
  listFolders,
  getFolder,
  listContentByFolder,
} from './tools/content.js'
import { listJourneys, getJourney, getJourneyStats, diffJourneyVersions, type JourneyDiff } from './tools/journeys.js'
import { listSends, getSendPerformance, getTrackingSummary } from './tools/sends.js'
import { listDataExtensions, getDataExtensionSchema } from './tools/data-extensions.js'
import { listBusinessUnits } from './tools/business-units.js'
import { listAutomations, getAutomation, getAutomationRuns } from './tools/automations.js'
import { listCampaigns, getCampaign, getCampaignAssets } from './tools/campaigns.js'
import { listTransactionalDefinitions, getTransactionalDefinition } from './tools/transactional.js'
import { listSeedLists, getSeedList } from './tools/seed-lists.js'
import { listSenderDomains, listSuppressionLists, getSuppressionList } from './tools/deliverability.js'
import { getContactSchema, getContactJourneyMembership } from './tools/contacts.js'
import { getApiEndpoints, getAuditLog } from './tools/platform.js'
import { listSmsDefinitions, getSmsDefinition, listSmsKeywords } from './tools/sms.js'
import { listPushApps, getPushApp, listPushMessages } from './tools/push.js'

// ── Public type re-exports ────────────────────────────────────────────────────
export type { SfmcConfig } from './types.js'
export type { ContentSearchResult, ContentDetail } from './tools/content.js'
export type { JourneySummary, JourneyDetail, JourneyDiff } from './tools/journeys.js'
export type { AutomationSummary, AutomationDetail, AutomationRun } from './tools/automations.js'
export type { CampaignSummary, CampaignAsset } from './tools/campaigns.js'
export type { TransactionalDefinition } from './tools/transactional.js'
export type { SeedList } from './tools/seed-lists.js'
export type { SenderDomain, SuppressionList } from './tools/deliverability.js'
export type { ContactAttributeSet, JourneyMembership } from './tools/contacts.js'
export type { ApiEndpoint, AuditEvent } from './tools/platform.js'
export type { SmsDefinition, SmsKeyword } from './tools/sms.js'
export type { PushApp, PushAppDetail, PushMessage } from './tools/push.js'

// Re-export utility types and helpers
export { TtlCache } from './lib/cache.js'
export { paginate } from './lib/paginate.js'
export type { Tracer, Span } from './lib/otel.js'

// ── Client factory ────────────────────────────────────────────────────────────

/**
 * Create an SFMC client with all read tools bound to the provided config.
 * Call `withMid(mid)` to get a new client scoped to a specific child BU.
 *
 * @param config - SFMC connection config (subdomain, clientId, clientSecret, optional mid)
 * @param options - Optional cache TTL in seconds and OpenTelemetry tracer
 */
export function createClient(
  config: SfmcConfig,
  options: { cacheTtlSeconds?: number; tracer?: Tracer } = {}
) {
  const cache = options.cacheTtlSeconds !== undefined
    ? new TtlCache()
    : undefined
  const cacheTtlMs = (options.cacheTtlSeconds ?? 0) * 1000
  const tracer = options.tracer

  /**
   * Wraps a function call with optional caching and optional tracing.
   */
  async function cached<T>(
    method: string,
    args: unknown[],
    fn: () => Promise<T>
  ): Promise<T> {
    const key = `${method}:${JSON.stringify(args)}`
    if (cache) {
      const hit = cache.get<T>(key)
      if (hit !== undefined) return hit
    }
    const result = await traced(tracer, method, { 'sfmc.subdomain': config.subdomain }, fn)
    if (cache) {
      cache.set(key, result, cacheTtlMs)
    }
    return result
  }

  return {
    /** Return a new client scoped to a different child BU MID. */
    withMid(mid: string) {
      return createClient({ ...config, mid }, options)
    },

    // ── Business Units ──────────────────────────────────────────────────────
    listBusinessUnits: () =>
      cached('listBusinessUnits', [], () => listBusinessUnits(config)),

    // ── Content Builder ─────────────────────────────────────────────────────
    searchContent: (params: Parameters<typeof searchContent>[1]) =>
      cached('searchContent', [params], () => searchContent(config, params)),
    getContentById: (assetId: number) =>
      cached('getContentById', [assetId], () => getContentById(config, assetId)),
    getContentByName: (name: string) =>
      cached('getContentByName', [name], () => getContentByName(config, name)),
    listFolders: () =>
      cached('listFolders', [], () => listFolders(config)),
    getFolder: (folderId: number) =>
      cached('getFolder', [folderId], () => getFolder(config, folderId)),
    listContentByFolder: (params: Parameters<typeof listContentByFolder>[1]) =>
      cached('listContentByFolder', [params], () => listContentByFolder(config, params)),

    // ── Journey Builder ─────────────────────────────────────────────────────
    listJourneys: (params?: Parameters<typeof listJourneys>[1]) =>
      cached('listJourneys', [params], () => listJourneys(config, params)),
    getJourney: (journeyId: string, version?: number) =>
      cached('getJourney', [journeyId, version], () => getJourney(config, journeyId, version)),
    getJourneyStats: (journeyId: string, version: number) =>
      cached('getJourneyStats', [journeyId, version], () => getJourneyStats(config, journeyId, version)),
    diffJourneyVersions: (journeyId: string, fromVersion: number, toVersion: number) =>
      cached('diffJourneyVersions', [journeyId, fromVersion, toVersion], () =>
        diffJourneyVersions(config, journeyId, fromVersion, toVersion)),

    // ── Send Performance ────────────────────────────────────────────────────
    listSends: (params?: Parameters<typeof listSends>[1]) =>
      cached('listSends', [params], () => listSends(config, params)),
    getSendPerformance: (sendId: string) =>
      cached('getSendPerformance', [sendId], () => getSendPerformance(config, sendId)),
    getTrackingSummary: (jobId: string) =>
      cached('getTrackingSummary', [jobId], () => getTrackingSummary(config, jobId)),

    // ── Data Extensions ─────────────────────────────────────────────────────
    listDataExtensions: (params?: Parameters<typeof listDataExtensions>[1]) =>
      cached('listDataExtensions', [params], () => listDataExtensions(config, params)),
    getDataExtensionSchema: (key: string) =>
      cached('getDataExtensionSchema', [key], () => getDataExtensionSchema(config, key)),

    // ── Automation Studio ───────────────────────────────────────────────────
    listAutomations: (params?: Parameters<typeof listAutomations>[1]) =>
      cached('listAutomations', [params], () => listAutomations(config, params)),
    getAutomation: (automationId: string) =>
      cached('getAutomation', [automationId], () => getAutomation(config, automationId)),
    getAutomationRuns: (automationId: string, params?: Parameters<typeof getAutomationRuns>[2]) =>
      cached('getAutomationRuns', [automationId, params], () => getAutomationRuns(config, automationId, params)),

    // ── Campaigns ───────────────────────────────────────────────────────────
    listCampaigns: (params?: Parameters<typeof listCampaigns>[1]) =>
      cached('listCampaigns', [params], () => listCampaigns(config, params)),
    getCampaign: (campaignId: string) =>
      cached('getCampaign', [campaignId], () => getCampaign(config, campaignId)),
    getCampaignAssets: (campaignId: string) =>
      cached('getCampaignAssets', [campaignId], () => getCampaignAssets(config, campaignId)),

    // ── Transactional Messaging ─────────────────────────────────────────────
    listTransactionalDefinitions: (params?: Parameters<typeof listTransactionalDefinitions>[1]) =>
      cached('listTransactionalDefinitions', [params], () => listTransactionalDefinitions(config, params)),
    getTransactionalDefinition: (definitionKey: string) =>
      cached('getTransactionalDefinition', [definitionKey], () => getTransactionalDefinition(config, definitionKey)),

    // ── Seed Lists ──────────────────────────────────────────────────────────
    listSeedLists: () =>
      cached('listSeedLists', [], () => listSeedLists(config)),
    getSeedList: (id: string) =>
      cached('getSeedList', [id], () => getSeedList(config, id)),

    // ── Deliverability ──────────────────────────────────────────────────────
    listSenderDomains: () =>
      cached('listSenderDomains', [], () => listSenderDomains(config)),
    listSuppressionLists: () =>
      cached('listSuppressionLists', [], () => listSuppressionLists(config)),
    getSuppressionList: (id: string) =>
      cached('getSuppressionList', [id], () => getSuppressionList(config, id)),

    // ── Contacts ────────────────────────────────────────────────────────────
    getContactSchema: () =>
      cached('getContactSchema', [], () => getContactSchema(config)),
    getContactJourneyMembership: (contactKey: string) =>
      cached('getContactJourneyMembership', [contactKey], () => getContactJourneyMembership(config, contactKey)),

    // ── Platform ────────────────────────────────────────────────────────────
    getApiEndpoints: () =>
      cached('getApiEndpoints', [], () => getApiEndpoints(config)),
    getAuditLog: (params?: Parameters<typeof getAuditLog>[1]) =>
      cached('getAuditLog', [params], () => getAuditLog(config, params)),

    // ── SMS ─────────────────────────────────────────────────────────────────
    listSmsDefinitions: (params?: Parameters<typeof listSmsDefinitions>[1]) =>
      cached('listSmsDefinitions', [params], () => listSmsDefinitions(config, params)),
    getSmsDefinition: (definitionKey: string) =>
      cached('getSmsDefinition', [definitionKey], () => getSmsDefinition(config, definitionKey)),
    listSmsKeywords: () =>
      cached('listSmsKeywords', [], () => listSmsKeywords(config)),

    // ── Push ────────────────────────────────────────────────────────────────
    listPushApps: () =>
      cached('listPushApps', [], () => listPushApps(config)),
    getPushApp: (appId: string) =>
      cached('getPushApp', [appId], () => getPushApp(config, appId)),
    listPushMessages: (appId: string, params?: Parameters<typeof listPushMessages>[2]) =>
      cached('listPushMessages', [appId, params], () => listPushMessages(config, appId, params)),
  }
}

export type SfmcClient = ReturnType<typeof createClient>

// Re-export diffJourneyVersions for direct use
export { diffJourneyVersions } from './tools/journeys.js'
export type { JourneyDiff as JourneyDiffType } from './tools/journeys.js'
