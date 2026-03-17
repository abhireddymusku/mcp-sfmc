export interface SfmcConfig {
  subdomain: string
  clientId: string
  clientSecret: string
  /** Optional — scope all requests to a specific child BU MID */
  mid?: string
}

export interface SfmcTokenResponse {
  access_token: string
  expires_in: number
  token_type: string
}

export interface SfmcBusinessUnit {
  id: number
  name: string
  parentId: number
}

export interface SfmcJourney {
  id: string
  key: string
  name: string
  description?: string
  version: number
  status: string
  stats?: {
    currentPopulation?: number
    cumulativePopulation?: number
  }
  activities: SfmcActivity[]
  createdDate: string
  modifiedDate: string
}

export interface SfmcActivity {
  id: string
  key: string
  name: string
  type: string
  outcomes?: Array<{
    key: string
    next: string
    arguments?: { branchResult?: string }
  }>
  configurationArguments?: {
    triggeredSendId?: string
    triggeredSendKey?: string
    emailId?: number
    contentBuilder?: { emailId?: number }
    triggeredSend?: { emailId?: number }
    legacyData?: { legacyId?: number }
  }
}

export interface SfmcContentAsset {
  id: number
  name: string
  assetType: { name: string; id: number }
  content?: string
  views?: {
    html?: {
      content?: string
      slots?: Record<string, SfmcContentSlot>
    }
    text?: { content: string }
    subjectline?: { content: string }
    preheader?: { content: string }
  }
  createdDate: string
  modifiedDate: string
  category?: { id: number; name: string; parentId: number }
}

export interface SfmcContentSlot {
  content?: string
  superContent?: string
  blocks?: Record<string, SfmcContentBlock>
}

export interface SfmcContentBlock {
  content?: string
  superContent?: string
  slots?: Record<string, SfmcContentSlot>
}

export interface SfmcDataExtension {
  key: string
  name: string
  description?: string
  fields?: Array<{
    name: string
    fieldType: string
    isPrimaryKey: boolean
    isRequired: boolean
    maxLength?: number
  }>
}

export interface SfmcSend {
  id: string
  name: string
  status: string
  definitionType: string
  requestId?: string
  scheduledTime?: string
  stats?: {
    requested: number
    sent: number
    delivered: number
    bounced: number
    opened: number
    clicked: number
    optedOut: number
  }
  createdDate: string
  modifiedDate: string
}

export interface ActivitySequenceItem {
  type: 'email' | 'wait' | 'split' | 'join' | 'other'
  label: string
  activityKey: string
  activityId: string
  emailAssetId?: number
  branchNote?: string
}
