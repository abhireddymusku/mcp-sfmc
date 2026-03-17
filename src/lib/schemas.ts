import { z } from 'zod'

export const PageParams = z.object({
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().max(200).optional(),
})

export const SearchParams = PageParams.extend({
  search: z.string().optional(),
})

export const GetContentInput = z.object({ assetId: z.number().int().positive() })
export const GetContentByNameInput = z.object({ name: z.string().min(1) })
export const GetFolderInput = z.object({ folderId: z.number().int().positive() })
export const ListContentByFolderInput = PageParams.extend({ folderId: z.number().int().positive() })

export const ListJourneysInput = SearchParams.extend({
  status: z.enum(['Running', 'Draft', 'Stopped', 'Paused']).optional(),
})
export const GetJourneyInput = z.object({
  journeyId: z.string().min(1),
  version: z.number().int().positive().optional(),
})
export const GetJourneyStatsInput = z.object({
  journeyId: z.string().min(1),
  version: z.number().int().positive(),
})
export const DiffJourneyVersionsInput = z.object({
  journeyId: z.string().min(1),
  fromVersion: z.number().int().positive(),
  toVersion: z.number().int().positive(),
})

export const GetSendPerformanceInput = z.object({ sendId: z.string().min(1) })
export const GetTrackingSummaryInput = z.object({ jobId: z.string().min(1) })

export const GetDeSchemaInput = z.object({ key: z.string().min(1) })

export const GetAutomationInput = z.object({ automationId: z.string().min(1) })
export const GetAutomationRunsInput = SearchParams.extend({ automationId: z.string().min(1) })

export const GetCampaignInput = z.object({ campaignId: z.string().min(1) })

export const GetTransactionalInput = z.object({ definitionKey: z.string().min(1) })
export const StatusFilterInput = PageParams.extend({ status: z.string().optional() })

export const GetSeedListInput = z.object({ id: z.string().min(1) })
export const GetSuppressionListInput = z.object({ id: z.string().min(1) })
export const GetContactJourneyInput = z.object({ contactKey: z.string().min(1) })

export const AuditLogInput = PageParams.extend({ objectType: z.string().optional() })
export const GetSmsDefinitionInput = z.object({ definitionKey: z.string().min(1) })
export const GetPushAppInput = z.object({ appId: z.string().min(1) })
export const ListPushMessagesInput = PageParams.extend({ appId: z.string().min(1) })
export const SetBuInput = z.object({ mid: z.string().min(1) })
