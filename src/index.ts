#!/usr/bin/env node
/**
 * mcp-sfmc — Read-only MCP server for Salesforce Marketing Cloud
 *
 * All tools are read-only. No data is written to or deleted from SFMC.
 * Subscriber-level PII (DE rows, individual subscriber records) is never returned.
 *
 * Usage:
 *   SFMC_SUBDOMAIN=xxx SFMC_CLIENT_ID=xxx SFMC_CLIENT_SECRET=xxx npx mcp-sfmc
 *   npx mcp-sfmc --subdomain xxx --client-id xxx --client-secret xxx [--mid xxx]
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from '@modelcontextprotocol/sdk/types.js'

import type { SfmcConfig } from './types.js'

// ── Content Builder ──
import {
  searchContent,
  getContentById,
  getContentByName,
  listFolders,
  getFolder,
  listContentByFolder,
} from './tools/content.js'

// ── Journey Builder ──
import { listJourneys, getJourney, getJourneyStats, diffJourneyVersions } from './tools/journeys.js'

// ── Send Performance ──
import { listSends, getSendPerformance, getTrackingSummary } from './tools/sends.js'

// ── Data Extensions ──
import { listDataExtensions, getDataExtensionSchema } from './tools/data-extensions.js'

// ── Business Units ──
import { listBusinessUnits } from './tools/business-units.js'

// ── Automation Studio ──
import { listAutomations, getAutomation, getAutomationRuns } from './tools/automations.js'

// ── Campaigns ──
import { listCampaigns, getCampaign, getCampaignAssets } from './tools/campaigns.js'

// ── Transactional Messaging (read) ──
import { listTransactionalDefinitions, getTransactionalDefinition } from './tools/transactional.js'

// ── Seed Lists ──
import { listSeedLists, getSeedList } from './tools/seed-lists.js'

// ── Deliverability ──
import { listSenderDomains, listSuppressionLists, getSuppressionList } from './tools/deliverability.js'

// ── Contacts ──
import { getContactSchema, getContactJourneyMembership } from './tools/contacts.js'

// ── Platform ──
import { getApiEndpoints, getAuditLog } from './tools/platform.js'

// ── SMS ──
import { listSmsDefinitions, getSmsDefinition, listSmsKeywords } from './tools/sms.js'

// ── Push ──
import { listPushApps, getPushApp, listPushMessages } from './tools/push.js'

// ── Zod schemas ──
import {
  GetContentInput,
  GetContentByNameInput,
  GetFolderInput,
  ListContentByFolderInput,
  ListJourneysInput,
  GetJourneyInput,
  GetJourneyStatsInput,
  DiffJourneyVersionsInput,
  GetSendPerformanceInput,
  GetTrackingSummaryInput,
  GetDeSchemaInput,
  GetAutomationInput,
  GetAutomationRunsInput,
  GetCampaignInput,
  GetTransactionalInput,
  StatusFilterInput,
  GetSeedListInput,
  GetSuppressionListInput,
  GetContactJourneyInput,
  AuditLogInput,
  GetSmsDefinitionInput,
  GetPushAppInput,
  ListPushMessagesInput,
  SetBuInput,
  SearchParams,
} from './lib/schemas.js'

// ─── Config resolution ────────────────────────────────────────────────────────

function resolveConfig(): SfmcConfig {
  const args = process.argv.slice(2)
  const arg = (flag: string) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : undefined
  }

  const subdomain = arg('--subdomain') ?? process.env.SFMC_SUBDOMAIN
  const clientId = arg('--client-id') ?? process.env.SFMC_CLIENT_ID
  const clientSecret = arg('--client-secret') ?? process.env.SFMC_CLIENT_SECRET
  const mid = arg('--mid') ?? process.env.SFMC_MID

  if (!subdomain || !clientId || !clientSecret) {
    console.error(
      'mcp-sfmc: Missing required credentials.\n' +
      'Set SFMC_SUBDOMAIN, SFMC_CLIENT_ID, SFMC_CLIENT_SECRET as env vars\n' +
      'or pass --subdomain --client-id --client-secret as CLI flags.\n'
    )
    process.exit(1)
  }

  return { subdomain, clientId, clientSecret, mid }
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  // ── Business Units ─────────────────────────────────────────────────────────
  {
    name: 'sfmc_list_business_units',
    description:
      'List all child business units (BUs) accessible from the parent SFMC account. ' +
      'Returns MID, name, and parent relationship for each BU.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'sfmc_set_bu',
    description:
      'Switch the active Business Unit for this session. ' +
      'After calling this, all subsequent tool calls will be scoped to the specified BU MID. ' +
      'Use sfmc_list_business_units to find available MIDs.',
    inputSchema: {
      type: 'object',
      properties: {
        mid: { type: 'string', description: 'Business Unit MID to scope requests to' },
      },
      required: ['mid'],
    },
  },
  {
    name: 'sfmc_get_current_bu',
    description: 'Show which Business Unit MID is currently active for this session.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },

  // ── Content Builder ────────────────────────────────────────────────────────
  {
    name: 'sfmc_search_content',
    description:
      'Search Content Builder for HTML email assets. ' +
      'Returns name, ID, type, folder, and dates. Use sfmc_get_content to fetch the HTML.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term (partial name match). Omit to list all.' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 20, max 200)' },
      },
      required: [],
    },
  },
  {
    name: 'sfmc_get_content',
    description:
      'Fetch the full rendered HTML for a Content Builder email asset by numeric ID. ' +
      'Also returns subject line, preheader, and plain text. Resolves template slot/block structure.',
    inputSchema: {
      type: 'object',
      properties: {
        assetId: { type: 'number', description: 'Content Builder asset ID (numeric)' },
      },
      required: ['assetId'],
    },
  },
  {
    name: 'sfmc_get_content_by_name',
    description: 'Fetch the full rendered HTML for a Content Builder email asset by exact name.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Exact name of the Content Builder asset' },
      },
      required: ['name'],
    },
  },
  {
    name: 'sfmc_list_folders',
    description: 'List the full Content Builder folder tree (ID, name, parentId).',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'sfmc_get_folder',
    description: 'Get a specific Content Builder folder by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        folderId: { type: 'number', description: 'Content Builder category/folder ID' },
      },
      required: ['folderId'],
    },
  },
  {
    name: 'sfmc_list_content_by_folder',
    description: 'List all email assets inside a specific Content Builder folder.',
    inputSchema: {
      type: 'object',
      properties: {
        folderId: { type: 'number', description: 'Folder ID to list assets from' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 20)' },
      },
      required: ['folderId'],
    },
  },

  // ── Journey Builder ────────────────────────────────────────────────────────
  {
    name: 'sfmc_list_journeys',
    description:
      'List Journey Builder journeys filtered by status. ' +
      'Returns name, ID, key, version, status, population stats, and email activity count.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['Running', 'Draft', 'Stopped', 'Paused'],
          description: 'Filter by journey status (default: Running)',
        },
        search: { type: 'string', description: 'Filter by journey name (optional partial match)' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'sfmc_get_journey',
    description:
      'Get full journey detail: activity sequence, email asset IDs, and population stats. ' +
      'Use emailAssetId values with sfmc_get_content to fetch each email\'s HTML.',
    inputSchema: {
      type: 'object',
      properties: {
        journeyId: { type: 'string', description: 'Journey ID (GUID)' },
        version: { type: 'number', description: 'Journey version number. Omit for latest.' },
      },
      required: ['journeyId'],
    },
  },
  {
    name: 'sfmc_get_journey_stats',
    description:
      'Get per-activity send statistics for a journey: ' +
      'sent, delivered, opened, clicked, bounced, opted-out per email activity.',
    inputSchema: {
      type: 'object',
      properties: {
        journeyId: { type: 'string', description: 'Journey ID (GUID)' },
        version: { type: 'number', description: 'Journey version number' },
      },
      required: ['journeyId', 'version'],
    },
  },
  {
    name: 'sfmc_diff_journey_versions',
    description: 'Compare two versions of a journey — see which activities were added, removed, or changed, and whether email assets were swapped.',
    inputSchema: {
      type: 'object',
      properties: {
        journeyId: { type: 'string', description: 'Journey ID (GUID)' },
        fromVersion: { type: 'number', description: 'Earlier version number' },
        toVersion: { type: 'number', description: 'Later version number' },
      },
      required: ['journeyId', 'fromVersion', 'toVersion'],
    },
  },

  // ── Send Performance ───────────────────────────────────────────────────────
  {
    name: 'sfmc_list_sends',
    description: 'List recent email send definitions with basic stats, ordered by creation date.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status (optional)' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 25)' },
      },
      required: [],
    },
  },
  {
    name: 'sfmc_get_send_performance',
    description:
      'Get detailed metrics for a specific send: sent, delivered, bounced, opened, clicked counts ' +
      'plus computed open rate, click rate, and bounce rate.',
    inputSchema: {
      type: 'object',
      properties: {
        sendId: { type: 'string', description: 'Send definition ID' },
      },
      required: ['sendId'],
    },
  },
  {
    name: 'sfmc_get_tracking_summary',
    description:
      'Get tracking summary using SFMC Data Views (sent/open/click/bounce/unsub counts). ' +
      'Requires Data Views access. Pass the numeric Job ID from a specific send.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'Numeric SFMC Job ID for the send' },
      },
      required: ['jobId'],
    },
  },

  // ── Data Extensions ────────────────────────────────────────────────────────
  {
    name: 'sfmc_list_data_extensions',
    description:
      'List Data Extensions with name, key, and field count. ' +
      'Useful for discovering available merge tag fields. No row data returned.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Filter DEs by name (optional)' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'sfmc_get_de_schema',
    description:
      'Get the field schema of a Data Extension: field names, types, primary keys. ' +
      'Use this to discover merge tag field names for personalisation. No row data returned.',
    inputSchema: {
      type: 'object',
      properties: {
        key: { type: 'string', description: 'External key (CustomerKey) of the Data Extension' },
      },
      required: ['key'],
    },
  },

  // ── Automation Studio ──────────────────────────────────────────────────────
  {
    name: 'sfmc_list_automations',
    description:
      'List Automation Studio automations in the current BU. ' +
      'Returns name, ID, status, last run time, and next scheduled run.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Filter automations by name (optional)' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 25)' },
      },
      required: [],
    },
  },
  {
    name: 'sfmc_get_automation',
    description:
      'Get full detail for an Automation Studio automation: schedule, steps, and activities.',
    inputSchema: {
      type: 'object',
      properties: {
        automationId: { type: 'string', description: 'Automation ID (GUID)' },
      },
      required: ['automationId'],
    },
  },
  {
    name: 'sfmc_get_automation_runs',
    description: 'Get the run history for an automation — start/end times, status, and any errors.',
    inputSchema: {
      type: 'object',
      properties: {
        automationId: { type: 'string', description: 'Automation ID (GUID)' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 25)' },
      },
      required: ['automationId'],
    },
  },

  // ── Campaigns ─────────────────────────────────────────────────────────────
  {
    name: 'sfmc_list_campaigns',
    description: 'List campaigns in the current BU with name, code, and dates.',
    inputSchema: {
      type: 'object',
      properties: {
        search: { type: 'string', description: 'Filter campaigns by name (optional)' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'sfmc_get_campaign',
    description: 'Get a single campaign by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'Campaign ID' },
      },
      required: ['campaignId'],
    },
  },
  {
    name: 'sfmc_get_campaign_assets',
    description:
      'Get all assets linked to a campaign — emails, journeys, automations, and content.',
    inputSchema: {
      type: 'object',
      properties: {
        campaignId: { type: 'string', description: 'Campaign ID' },
      },
      required: ['campaignId'],
    },
  },

  // ── Transactional Messaging (read) ─────────────────────────────────────────
  {
    name: 'sfmc_list_transactional_definitions',
    description:
      'List transactional email send definitions. ' +
      'Returns key, name, status, from address, and linked content asset.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status: Active, Inactive (optional)' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'sfmc_get_transactional_definition',
    description: 'Get a single transactional email definition by its definition key.',
    inputSchema: {
      type: 'object',
      properties: {
        definitionKey: { type: 'string', description: 'Transactional definition key' },
      },
      required: ['definitionKey'],
    },
  },

  // ── Seed Lists ─────────────────────────────────────────────────────────────
  {
    name: 'sfmc_list_seed_lists',
    description:
      'List seed lists in the current BU. Returns name, ID, and address count. ' +
      'Individual seed addresses are not returned.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'sfmc_get_seed_list',
    description: 'Get a single seed list by ID — name, description, and address count.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Seed list ID' },
      },
      required: ['id'],
    },
  },

  // ── Deliverability ─────────────────────────────────────────────────────────
  {
    name: 'sfmc_list_sender_domains',
    description:
      'List authenticated sender domains (SAP / Private Domain) configured in this account. ' +
      'Shows DKIM and SPF verification status — useful for diagnosing deliverability.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'sfmc_list_suppression_lists',
    description:
      'List suppression lists in the current BU with name, type, and address count. ' +
      'Individual suppressed addresses are not returned.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'sfmc_get_suppression_list',
    description: 'Get a single suppression list by ID — name, type, and address count.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Suppression list ID' },
      },
      required: ['id'],
    },
  },

  // ── Contacts ───────────────────────────────────────────────────────────────
  {
    name: 'sfmc_get_contact_schema',
    description:
      'Get the contact data schema — attribute sets and field names available in Contact Builder. ' +
      'Useful for understanding what contact attributes exist for personalisation. ' +
      'No individual contact data is returned.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'sfmc_get_contact_journey_membership',
    description:
      'Get which journeys a contact is currently active in, using their contact/subscriber key. ' +
      'Returns journey names, versions, current activity position, and entry dates.',
    inputSchema: {
      type: 'object',
      properties: {
        contactKey: { type: 'string', description: 'Contact key (subscriber key) to look up' },
      },
      required: ['contactKey'],
    },
  },

  // ── Platform ───────────────────────────────────────────────────────────────
  {
    name: 'sfmc_get_api_endpoints',
    description:
      'Get all REST API endpoints available for this SFMC account. ' +
      'Useful for understanding which API capabilities are enabled for this edition.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'sfmc_get_audit_log',
    description:
      'Get recent audit events — who changed what and when in this SFMC account. ' +
      'Useful for security reviews and debugging unexpected configuration changes.',
    inputSchema: {
      type: 'object',
      properties: {
        objectType: { type: 'string', description: 'Filter by object type (optional)' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 50)' },
      },
      required: [],
    },
  },

  // ── SMS ────────────────────────────────────────────────────────────────────
  {
    name: 'sfmc_list_sms_definitions',
    description:
      'List SMS send definitions in the current BU — name, key, status, short code, and keyword.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by status (optional)' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 50)' },
      },
      required: [],
    },
  },
  {
    name: 'sfmc_get_sms_definition',
    description: 'Get a single SMS send definition by its definition key.',
    inputSchema: {
      type: 'object',
      properties: {
        definitionKey: { type: 'string', description: 'SMS definition key' },
      },
      required: ['definitionKey'],
    },
  },
  {
    name: 'sfmc_list_sms_keywords',
    description: 'List SMS opt-in keywords configured in the current BU.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },

  // ── Push ───────────────────────────────────────────────────────────────────
  {
    name: 'sfmc_list_push_apps',
    description: 'List mobile push notification apps configured in the current BU.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'sfmc_get_push_app',
    description: 'Get full detail for a specific push notification app.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Push application ID' },
      },
      required: ['appId'],
    },
  },
  {
    name: 'sfmc_list_push_messages',
    description:
      'List push messages (campaigns) for a specific push app with aggregate send counts. ' +
      'No individual device or subscriber data is returned.',
    inputSchema: {
      type: 'object',
      properties: {
        appId: { type: 'string', description: 'Push application ID' },
        page: { type: 'number', description: 'Page number (default 1)' },
        pageSize: { type: 'number', description: 'Results per page (default 50)' },
      },
      required: ['appId'],
    },
  },
]

// ─── Server setup ─────────────────────────────────────────────────────────────

async function main() {
  const config = resolveConfig()

  // Detect CLI mode: stdin is a TTY (not piped from MCP client) or explicit CLI flags present
  const CLI_FLAGS = ['--list-journeys','--get-journey','--search-content','--get-content',
    '--get-content-by-name','--list-automations','--list-sends','--list-data-extensions',
    '--list-business-units','--help']
  const argv = process.argv.slice(2)
  const isCli = (process.stdin.isTTY === true) || argv.some(a => CLI_FLAGS.includes(a))
  if (isCli) {
    const { runCli } = await import('./cli.js')
    await runCli(config)
    process.exit(0)
  }

  // Active BU MID — can be changed at runtime via sfmc_set_bu.
  // Starts as whatever was set in env/args.
  let activeMid: string | undefined = config.mid

  const server = new Server(
    { name: 'mcp-sfmc', version: '0.1.0' },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params

    // Build effective config — may be overridden per-call or by sfmc_set_bu state
    const effectiveConfig: typeof config = { ...config, mid: activeMid }

    // Handle session-management tools inline (they need closure access to activeMid)
    if (name === 'sfmc_set_bu') {
      const { mid } = SetBuInput.parse(args)
      activeMid = mid
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ success: true, activeMid: mid }),
        }],
      }
    }

    if (name === 'sfmc_get_current_bu') {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            activeMid: activeMid ?? null,
            note: activeMid
              ? `All requests are scoped to BU MID ${activeMid}. Use sfmc_set_bu to switch BUs.`
              : 'No MID set — requests use parent BU scope. Use sfmc_set_bu to scope to a child BU.',
          }),
        }],
      }
    }

    try {
      const result = await dispatch(effectiveConfig, name, args as Record<string, unknown>)
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      }
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)

  process.stderr.write('mcp-sfmc connected — ready\n')
}

// ─── Tool dispatcher ──────────────────────────────────────────────────────────

async function dispatch(
  config: SfmcConfig,
  tool: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (tool) {
    // Business Units
    case 'sfmc_list_business_units':
      return listBusinessUnits(config)

    // Content Builder
    case 'sfmc_search_content': {
      const parsed = SearchParams.parse(args)
      return searchContent(config, {
        query: typeof args.query === 'string' ? args.query : undefined,
        page: parsed.page,
        pageSize: parsed.pageSize,
      })
    }

    case 'sfmc_get_content': {
      const { assetId } = GetContentInput.parse(args)
      return getContentById(config, assetId)
    }

    case 'sfmc_get_content_by_name': {
      const { name } = GetContentByNameInput.parse(args)
      return getContentByName(config, name)
    }

    case 'sfmc_list_folders':
      return listFolders(config)

    case 'sfmc_get_folder': {
      const { folderId } = GetFolderInput.parse(args)
      return getFolder(config, folderId)
    }

    case 'sfmc_list_content_by_folder': {
      const { folderId, page, pageSize } = ListContentByFolderInput.parse(args)
      return listContentByFolder(config, { folderId, page, pageSize })
    }

    // Journey Builder
    case 'sfmc_list_journeys': {
      const { status, search, page, pageSize } = ListJourneysInput.parse(args)
      return listJourneys(config, { status, search, page, pageSize })
    }

    case 'sfmc_get_journey': {
      const { journeyId, version } = GetJourneyInput.parse(args)
      return getJourney(config, journeyId, version)
    }

    case 'sfmc_get_journey_stats': {
      const { journeyId, version } = GetJourneyStatsInput.parse(args)
      return getJourneyStats(config, journeyId, version)
    }

    case 'sfmc_diff_journey_versions': {
      const { journeyId, fromVersion, toVersion } = DiffJourneyVersionsInput.parse(args)
      return diffJourneyVersions(config, journeyId, fromVersion, toVersion)
    }

    // Send Performance
    case 'sfmc_list_sends': {
      const { status, page, pageSize } = StatusFilterInput.parse(args)
      return listSends(config, { status, page, pageSize })
    }

    case 'sfmc_get_send_performance': {
      const { sendId } = GetSendPerformanceInput.parse(args)
      return getSendPerformance(config, sendId)
    }

    case 'sfmc_get_tracking_summary': {
      const { jobId } = GetTrackingSummaryInput.parse(args)
      return getTrackingSummary(config, jobId)
    }

    // Data Extensions
    case 'sfmc_list_data_extensions': {
      const { search, page, pageSize } = SearchParams.parse(args)
      return listDataExtensions(config, { search, page, pageSize })
    }

    case 'sfmc_get_de_schema': {
      const { key } = GetDeSchemaInput.parse(args)
      return getDataExtensionSchema(config, key)
    }

    // Automation Studio
    case 'sfmc_list_automations': {
      const { search, page, pageSize } = SearchParams.parse(args)
      return listAutomations(config, { search, page, pageSize })
    }

    case 'sfmc_get_automation': {
      const { automationId } = GetAutomationInput.parse(args)
      return getAutomation(config, automationId)
    }

    case 'sfmc_get_automation_runs': {
      const { automationId, page, pageSize } = GetAutomationRunsInput.parse(args)
      return getAutomationRuns(config, automationId, { page, pageSize })
    }

    // Campaigns
    case 'sfmc_list_campaigns': {
      const { search, page, pageSize } = SearchParams.parse(args)
      return listCampaigns(config, { search, page, pageSize })
    }

    case 'sfmc_get_campaign': {
      const { campaignId } = GetCampaignInput.parse(args)
      return getCampaign(config, campaignId)
    }

    case 'sfmc_get_campaign_assets': {
      const { campaignId } = GetCampaignInput.parse(args)
      return getCampaignAssets(config, campaignId)
    }

    // Transactional Messaging (read)
    case 'sfmc_list_transactional_definitions': {
      const { status, page, pageSize } = StatusFilterInput.parse(args)
      return listTransactionalDefinitions(config, { status, page, pageSize })
    }

    case 'sfmc_get_transactional_definition': {
      const { definitionKey } = GetTransactionalInput.parse(args)
      return getTransactionalDefinition(config, definitionKey)
    }

    // Seed Lists
    case 'sfmc_list_seed_lists':
      return listSeedLists(config)

    case 'sfmc_get_seed_list': {
      const { id } = GetSeedListInput.parse(args)
      return getSeedList(config, id)
    }

    // Deliverability
    case 'sfmc_list_sender_domains':
      return listSenderDomains(config)

    case 'sfmc_list_suppression_lists':
      return listSuppressionLists(config)

    case 'sfmc_get_suppression_list': {
      const { id } = GetSuppressionListInput.parse(args)
      return getSuppressionList(config, id)
    }

    // Contacts
    case 'sfmc_get_contact_schema':
      return getContactSchema(config)

    case 'sfmc_get_contact_journey_membership': {
      const { contactKey } = GetContactJourneyInput.parse(args)
      return getContactJourneyMembership(config, contactKey)
    }

    // Platform
    case 'sfmc_get_api_endpoints':
      return getApiEndpoints(config)

    case 'sfmc_get_audit_log': {
      const { objectType, page, pageSize } = AuditLogInput.parse(args)
      return getAuditLog(config, { objectType, page, pageSize })
    }

    // SMS
    case 'sfmc_list_sms_definitions': {
      const { status, page, pageSize } = StatusFilterInput.parse(args)
      return listSmsDefinitions(config, { status, page, pageSize })
    }

    case 'sfmc_get_sms_definition': {
      const { definitionKey } = GetSmsDefinitionInput.parse(args)
      return getSmsDefinition(config, definitionKey)
    }

    case 'sfmc_list_sms_keywords':
      return listSmsKeywords(config)

    // Push
    case 'sfmc_list_push_apps':
      return listPushApps(config)

    case 'sfmc_get_push_app': {
      const { appId } = GetPushAppInput.parse(args)
      return getPushApp(config, appId)
    }

    case 'sfmc_list_push_messages': {
      const { appId, page, pageSize } = ListPushMessagesInput.parse(args)
      return listPushMessages(config, appId, { page, pageSize })
    }

    default:
      throw new Error(`Unknown tool: ${tool}`)
  }
}

main().catch((err) => {
  console.error('mcp-sfmc fatal error:', err)
  process.exit(1)
})
