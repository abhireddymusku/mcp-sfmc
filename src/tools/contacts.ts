import { sfmcGet, sfmcPost } from '../client.js'
import type { SfmcConfig } from '../types.js'

interface ContactSchemaResponse {
  schema?: Array<{
    name: string
    fullyQualifiedName?: string
    fields?: Array<{
      name: string
      dataType?: string
      isSystemDefined?: boolean
      isPrimaryKey?: boolean
      isRequired?: boolean
    }>
  }>
  attributeSets?: Array<{
    name: string
    id?: string
    fields?: Array<{
      name: string
      dataType?: string
    }>
  }>
}

interface JourneyMembershipResponse {
  contactMemberships?: Array<{
    definitionKey?: string
    definitionId?: string
    definitionName?: string
    currentActivities?: Array<{
      activityKey?: string
      activityName?: string
      startDate?: string
    }>
    version?: number
    status?: string
    firstEnteredDate?: string
    lastExitedDate?: string
  }>
}

export interface ContactAttributeSet {
  name: string
  id?: string
  fields: Array<{ name: string; dataType?: string }>
}

export interface JourneyMembership {
  journeyKey?: string
  journeyId?: string
  journeyName?: string
  version?: number
  status?: string
  currentActivity?: string
  firstEnteredDate?: string
  lastExitedDate?: string
}

/**
 * Get the contact data schema — attribute sets, field names, and data types.
 * Useful for understanding what contact attributes are available for personalisation.
 * Does not return any individual contact data.
 */
export async function getContactSchema(
  config: SfmcConfig
): Promise<{ attributeSets: ContactAttributeSet[] }> {
  const data = await sfmcGet<ContactSchemaResponse>(
    config,
    '/contacts/v1/schema'
  ).catch((): ContactSchemaResponse => ({}))

  const sets = data.attributeSets ?? data.schema ?? []

  return {
    attributeSets: sets.map((s) => ({
      name: s.name,
      id: 'id' in s ? (s as { id?: string }).id : undefined,
      fields: (s.fields ?? []).map((f) => ({
        name: f.name,
        dataType: f.dataType,
      })),
    })),
  }
}

/**
 * Get which journeys a specific contact is currently active in.
 * Input: a contact key (subscriber key). Output: journey names and activity positions.
 * No PII is returned beyond what was provided as input.
 */
export async function getContactJourneyMembership(
  config: SfmcConfig,
  contactKey: string
): Promise<{ contactKey: string; memberships: JourneyMembership[] }> {
  const data = await sfmcPost<JourneyMembershipResponse>(
    config,
    '/interaction/v1/interactions/contactMembership',
    {
      ContactKeyList: [contactKey],
    }
  ).catch(() => ({ contactMemberships: [] }))

  return {
    contactKey,
    memberships: (data.contactMemberships ?? []).map((m) => ({
      journeyKey: m.definitionKey,
      journeyId: m.definitionId,
      journeyName: m.definitionName,
      version: m.version,
      status: m.status,
      currentActivity: m.currentActivities?.[0]?.activityName,
      firstEnteredDate: m.firstEnteredDate,
      lastExitedDate: m.lastExitedDate,
    })),
  }
}
