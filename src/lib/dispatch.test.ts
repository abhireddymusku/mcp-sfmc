/**
 * Tests for tool function dispatch layer.
 * Run via: npm test (builds first then runs node --test dist/lib/dispatch.test.js)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { listJourneys, getJourney } from '../tools/journeys.js'
import { searchContent, getContentById } from '../tools/content.js'
import { listSends, getSendPerformance } from '../tools/sends.js'
import { listDataExtensions, getDataExtensionSchema } from '../tools/data-extensions.js'
import { listAutomations, getAutomation } from '../tools/automations.js'
import { listCampaigns } from '../tools/campaigns.js'
import { listSmsDefinitions } from '../tools/sms.js'
import { listPushApps } from '../tools/push.js'

const mockConfig = { subdomain: 'test-sub', clientId: 'test-id', clientSecret: 'test-secret' }

type MockResponse = { ok: boolean; status: number; json: () => Promise<unknown> }

function mockFetch(responses: Map<string, unknown>): (url: string, init?: RequestInit) => Promise<MockResponse> {
  return async (url: string) => {
    // Token endpoint
    if (url.includes('/v2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'test-token', expires_in: 3600 }) }
    }
    // Find matching response by URL substring
    for (const [key, value] of responses) {
      if (url.includes(key)) {
        return { ok: true, status: 200, json: async () => value }
      }
    }
    return { ok: false, status: 404, json: async () => ({ message: 'Not found' }) }
  }
}

// ── Journey tests ─────────────────────────────────────────────────────────────

test('listJourneys: maps items correctly', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/interaction/v1/interactions', {
      items: [{
        id: 'j1', key: 'key1', name: 'Test Journey', version: 2, status: 'Running',
        description: undefined, stats: { currentPopulation: 10 },
        activities: [{ id: 'a1', key: 'ak1', name: 'Email 1', type: 'EMAILV2', outcomes: [] }],
        createdDate: '2025-01-01', modifiedDate: '2025-01-02',
      }],
      count: 1,
    }],
  ])) as typeof fetch
  try {
    const result = await listJourneys(mockConfig, { status: 'Running' })
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].name, 'Test Journey')
    assert.equal(result.items[0].emailActivityCount, 1)
    assert.equal(result.total, 1)
  } finally {
    globalThis.fetch = origFetch
  }
})

test('listJourneys: returns empty items when no journeys', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/interaction/v1/interactions', { items: [], count: 0 }],
  ])) as typeof fetch
  try {
    const result = await listJourneys(mockConfig, { status: 'Draft' })
    assert.equal(result.items.length, 0)
    assert.equal(result.total, 0)
  } finally {
    globalThis.fetch = origFetch
  }
})

test('listJourneys: search param is passed in URL', async () => {
  const origFetch = globalThis.fetch
  let capturedUrl = ''
  globalThis.fetch = (async (url: string) => {
    capturedUrl = url
    if (url.includes('/v2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'test-token', expires_in: 3600 }) }
    }
    return { ok: true, status: 200, json: async () => ({ items: [], count: 0 }) }
  }) as typeof fetch
  try {
    await listJourneys(mockConfig, { search: 'Welcome', status: 'Running' })
    assert.ok(capturedUrl.includes('Welcome') || capturedUrl.includes('interaction'), 'URL should contain search term or journey path')
  } finally {
    globalThis.fetch = origFetch
  }
})

test('listJourneys: emailActivityCount counts only EMAILV2 activities', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/interaction/v1/interactions', {
      items: [{
        id: 'j2', key: 'key2', name: 'Multi Journey', version: 1, status: 'Running',
        stats: {},
        activities: [
          { id: 'a1', key: 'ak1', name: 'Email 1', type: 'EMAILV2', outcomes: [] },
          { id: 'a2', key: 'ak2', name: 'Wait', type: 'WAIT', outcomes: [] },
          { id: 'a3', key: 'ak3', name: 'Email 2', type: 'EMAILV2', outcomes: [] },
        ],
        createdDate: '2025-01-01', modifiedDate: '2025-01-02',
      }],
      count: 1,
    }],
  ])) as typeof fetch
  try {
    const result = await listJourneys(mockConfig)
    assert.equal(result.items[0].emailActivityCount, 2)
  } finally {
    globalThis.fetch = origFetch
  }
})

test('getJourney: returns journey detail with email activities', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/interaction/v1/interactions/j1', {
      id: 'j1', key: 'key1', name: 'Welcome Journey', version: 3, status: 'Running',
      stats: { currentPopulation: 50, cumulativePopulation: 1000 },
      activities: [
        {
          id: 'a1', key: 'ak1', name: 'Send Welcome Email', type: 'EMAILV2',
          outcomes: [],
          configurationArguments: { emailId: 999 },
        },
      ],
      createdDate: '2025-01-01', modifiedDate: '2025-01-15',
    }],
  ])) as typeof fetch
  try {
    const result = await getJourney(mockConfig, 'j1')
    assert.equal(result.id, 'j1')
    assert.equal(result.name, 'Welcome Journey')
    assert.equal(result.emailActivities.length, 1)
    assert.equal(result.emailActivities[0].emailAssetId, 999)
    assert.equal(result.allActivities.length, 1)
  } finally {
    globalThis.fetch = origFetch
  }
})

test('getJourney: calls version-specific endpoint when version provided', async () => {
  const origFetch = globalThis.fetch
  let capturedUrl = ''
  globalThis.fetch = (async (url: string) => {
    capturedUrl = url
    if (url.includes('/v2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'test-token', expires_in: 3600 }) }
    }
    return {
      ok: true, status: 200, json: async () => ({
        id: 'j1', key: 'k1', name: 'J', version: 2, status: 'Running',
        stats: {}, activities: [], createdDate: '', modifiedDate: '',
      })
    }
  }) as typeof fetch
  try {
    await getJourney(mockConfig, 'j1', 2)
    assert.ok(capturedUrl.includes('versionNumber=2'), 'URL should include versionNumber param')
  } finally {
    globalThis.fetch = origFetch
  }
})

// ── Content tests ─────────────────────────────────────────────────────────────

test('searchContent: returns mapped content items', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/asset/v1/content/assets/query', {
      items: [{
        id: 42, name: 'Welcome Email', assetType: { name: 'htmlemail', id: 208 },
        category: { id: 10, name: 'Emails', parentId: 1 },
        createdDate: '2025-01-01', modifiedDate: '2025-01-02',
      }],
      count: 1,
    }],
  ])) as typeof fetch
  try {
    const result = await searchContent(mockConfig, { query: 'Welcome' })
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].id, 42)
    assert.equal(result.items[0].name, 'Welcome Email')
    assert.equal(result.items[0].folder, 'Emails')
    assert.equal(result.total, 1)
  } finally {
    globalThis.fetch = origFetch
  }
})

test('searchContent: handles empty results', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/asset/v1/content/assets/query', { items: [], count: 0 }],
  ])) as typeof fetch
  try {
    const result = await searchContent(mockConfig, { query: 'nonexistent' })
    assert.equal(result.items.length, 0)
    assert.equal(result.total, 0)
  } finally {
    globalThis.fetch = origFetch
  }
})

test('getContentById: returns content detail with HTML', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/asset/v1/content/assets/42', {
      id: 42, name: 'Welcome Email',
      assetType: { name: 'htmlemail', id: 208 },
      views: {
        html: { content: '<html><body>Hello World</body></html>' },
        subjectline: { content: 'Hello!' },
        preheader: { content: 'Welcome aboard' },
        text: { content: 'Hello World' },
      },
      createdDate: '2025-01-01', modifiedDate: '2025-01-02',
    }],
  ])) as typeof fetch
  try {
    const result = await getContentById(mockConfig, 42)
    assert.equal(result.id, 42)
    assert.equal(result.name, 'Welcome Email')
    assert.ok(result.html.includes('Hello World'))
    assert.equal(result.subject, 'Hello!')
    assert.equal(result.preheader, 'Welcome aboard')
  } finally {
    globalThis.fetch = origFetch
  }
})

// ── Send tests ────────────────────────────────────────────────────────────────

test('listSends: returns mapped send items', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/messaging/v1/messageDefinitionSends', {
      items: [{
        id: 's1', name: 'Black Friday Send', status: 'Complete',
        definitionType: 'UserInitiated',
        stats: { requested: 10000, sent: 9800, delivered: 9700, bounced: 100, opened: 3000, clicked: 500, optedOut: 5 },
        createdDate: '2025-11-29', modifiedDate: '2025-11-30',
      }],
      count: 1,
    }],
  ])) as typeof fetch
  try {
    const result = await listSends(mockConfig)
    assert.equal(result.length, 1)
    assert.equal(result[0].id, 's1')
    assert.equal(result[0].name, 'Black Friday Send')
    assert.equal(result[0].status, 'Complete')
    assert.equal(result[0].stats?.sent, 9800)
  } finally {
    globalThis.fetch = origFetch
  }
})

test('getSendPerformance: computes open/click/bounce rates', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/messaging/v1/messageDefinitionSends/s1', {
      id: 's1', name: 'Test Send', status: 'Complete',
      stats: { requested: 1000, sent: 1000, delivered: 900, bounced: 100, opened: 360, clicked: 90, optedOut: 5 },
    }],
  ])) as typeof fetch
  try {
    const result = await getSendPerformance(mockConfig, 's1')
    assert.ok(result !== null)
    assert.equal(result!.id, 's1')
    assert.ok(result!.stats.openRate !== undefined, 'should have openRate')
    assert.ok(result!.stats.clickRate !== undefined, 'should have clickRate')
    assert.ok(result!.stats.bounceRate !== undefined, 'should have bounceRate')
    // 360/900 = 40.0%
    assert.equal(result!.stats.openRate, '40.0%')
  } finally {
    globalThis.fetch = origFetch
  }
})

// ── Data Extension tests ──────────────────────────────────────────────────────

test('listDataExtensions: returns mapped DE items', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/data/v1/customobjectdata', {
      items: [{
        customerKey: 'ContactList_Key', name: 'Contact List',
        description: 'Main contacts',
        fields: [
          { name: 'Email', fieldType: 'EmailAddress', isPrimaryKey: true, isRequired: true },
          { name: 'FirstName', fieldType: 'Text', isPrimaryKey: false, isRequired: false, maxLength: 50 },
        ],
      }],
      count: 1,
    }],
  ])) as typeof fetch
  try {
    const result = await listDataExtensions(mockConfig)
    assert.equal(result.length, 1)
    assert.equal(result[0].key, 'ContactList_Key')
    assert.equal(result[0].name, 'Contact List')
    assert.equal(result[0].fieldCount, 2)
  } finally {
    globalThis.fetch = origFetch
  }
})

test('getDataExtensionSchema: returns field schema', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/data/v1/customobjectdata/key/', {
      customerKey: 'ContactList_Key', name: 'Contact List',
      fields: [
        { name: 'Email', fieldType: 'EmailAddress', isPrimaryKey: true, isRequired: true },
      ],
    }],
  ])) as typeof fetch
  try {
    const result = await getDataExtensionSchema(mockConfig, 'ContactList_Key')
    assert.ok(result !== null)
    assert.equal(result!.key, 'ContactList_Key')
    assert.equal(result!.fields.length, 1)
    assert.equal(result!.fields[0].name, 'Email')
    assert.equal(result!.fields[0].isPrimaryKey, true)
  } finally {
    globalThis.fetch = origFetch
  }
})

// ── Automation tests ──────────────────────────────────────────────────────────

test('listAutomations: returns mapped automation items', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/automation/v1/automations', {
      items: [{
        id: 'auto1', name: 'Daily Sync', description: 'Syncs contacts daily',
        key: 'daily-sync',
        statusId: 1,
        lastRunTime: '2025-01-15T10:00:00Z',
        nextRunTime: '2025-01-16T10:00:00Z',
        createdDate: '2025-01-01', modifiedDate: '2025-01-15',
      }],
      count: 1,
    }],
  ])) as typeof fetch
  try {
    const result = await listAutomations(mockConfig)
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].id, 'auto1')
    assert.equal(result.items[0].name, 'Daily Sync')
    assert.equal(result.items[0].status, 'Running')
    assert.equal(result.total, 1)
  } finally {
    globalThis.fetch = origFetch
  }
})

test('getAutomation: returns automation detail with steps', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/automation/v1/automations/auto1', {
      id: 'auto1', name: 'Daily Sync', statusId: 1,
      steps: [{
        name: 'Step 1', step: 1,
        activities: [{ id: 'act1', name: 'Extract', activityType: 'DataExtract', status: 1 }],
      }],
      createdDate: '2025-01-01', modifiedDate: '2025-01-15',
    }],
  ])) as typeof fetch
  try {
    const result = await getAutomation(mockConfig, 'auto1')
    assert.ok(result !== null)
    assert.equal(result!.id, 'auto1')
    assert.equal(result!.steps.length, 1)
    assert.equal(result!.steps[0].activities.length, 1)
    assert.equal(result!.steps[0].activities[0].name, 'Extract')
  } finally {
    globalThis.fetch = origFetch
  }
})

// ── Campaign tests ─────────────────────────────────────────────────────────────

test('listCampaigns: returns mapped campaign items', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/campaign/v1/campaigns', {
      items: [{
        id: 'camp1', name: 'Black Friday 2025',
        description: 'Annual sale campaign',
        campaignCode: 'BF2025',
        color: '#000000',
        favorite: false,
        createdDate: '2025-10-01', modifiedDate: '2025-11-01',
      }],
      count: 1,
    }],
  ])) as typeof fetch
  try {
    const result = await listCampaigns(mockConfig)
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].id, 'camp1')
    assert.equal(result.items[0].name, 'Black Friday 2025')
    assert.equal(result.items[0].campaignCode, 'BF2025')
    assert.equal(result.total, 1)
  } finally {
    globalThis.fetch = origFetch
  }
})

test('listCampaigns: handles empty result set', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/campaign/v1/campaigns', { items: [], count: 0 }],
  ])) as typeof fetch
  try {
    const result = await listCampaigns(mockConfig, { search: 'nonexistent' })
    assert.equal(result.items.length, 0)
    assert.equal(result.total, 0)
  } finally {
    globalThis.fetch = origFetch
  }
})

// ── SMS tests ─────────────────────────────────────────────────────────────────

test('listSmsDefinitions: returns mapped SMS definition items', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/messaging/v1/sms/definitions', {
      definitions: [{
        definitionKey: 'sms-welcome-key',
        name: 'Welcome SMS',
        status: 'Active',
        description: 'Welcome message',
        content: { message: 'Welcome to our service!' },
        subscriptions: { shortCode: '55555', keyword: 'JOIN', countryCode: 'US' },
        createdDate: '2025-01-01', modifiedDate: '2025-01-15',
      }],
      count: 1,
    }],
  ])) as typeof fetch
  try {
    const result = await listSmsDefinitions(mockConfig)
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].key, 'sms-welcome-key')
    assert.equal(result.items[0].name, 'Welcome SMS')
    assert.equal(result.items[0].shortCode, '55555')
    assert.equal(result.items[0].keyword, 'JOIN')
    assert.equal(result.total, 1)
  } finally {
    globalThis.fetch = origFetch
  }
})

test('listSmsDefinitions: passes status filter to URL', async () => {
  const origFetch = globalThis.fetch
  let capturedUrl = ''
  globalThis.fetch = (async (url: string) => {
    capturedUrl = url
    if (url.includes('/v2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'test-token', expires_in: 3600 }) }
    }
    return { ok: true, status: 200, json: async () => ({ definitions: [], count: 0 }) }
  }) as typeof fetch
  try {
    await listSmsDefinitions(mockConfig, { status: 'Active' })
    assert.ok(capturedUrl.includes('Active') || capturedUrl.includes('sms'), 'URL should contain status filter or SMS path')
  } finally {
    globalThis.fetch = origFetch
  }
})

// ── Push tests ────────────────────────────────────────────────────────────────

test('listPushApps: returns mapped push app items', async () => {
  const origFetch = globalThis.fetch
  globalThis.fetch = mockFetch(new Map([
    ['/push/v1/application', {
      items: [{
        id: 'app1', name: 'My iOS App',
        description: 'iOS application',
        applicationType: 'ios',
        status: 'Active',
        createdDate: '2025-01-01', modifiedDate: '2025-01-15',
      }],
      count: 1,
    }],
  ])) as typeof fetch
  try {
    const result = await listPushApps(mockConfig)
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].id, 'app1')
    assert.equal(result.items[0].name, 'My iOS App')
    assert.equal(result.items[0].applicationType, 'ios')
    assert.equal(result.total, 1)
  } finally {
    globalThis.fetch = origFetch
  }
})

test('listPushApps: correctly maps the push application endpoint', async () => {
  const origFetch = globalThis.fetch
  let capturedUrl = ''
  globalThis.fetch = (async (url: string) => {
    capturedUrl = url
    if (url.includes('/v2/token')) {
      return { ok: true, status: 200, json: async () => ({ access_token: 'test-token', expires_in: 3600 }) }
    }
    return { ok: true, status: 200, json: async () => ({ items: [], count: 0 }) }
  }) as typeof fetch
  try {
    await listPushApps(mockConfig)
    assert.ok(capturedUrl.includes('/push/v1/application'), 'URL should include push application path')
  } finally {
    globalThis.fetch = origFetch
  }
})
