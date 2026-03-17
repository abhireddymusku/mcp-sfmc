import { sfmcGet } from '../client.js'
import type { SfmcConfig } from '../types.js'

const STATUS_MAP: Record<number, string> = {
  0: 'Scheduled',
  1: 'Running',
  2: 'Paused',
  3: 'Stopped',
  4: 'Error',
  5: 'Building',
  6: 'Inactive',
  7: 'Deleted',
}

interface AutomationListResponse {
  items?: Array<{
    id: string
    name: string
    description?: string
    key?: string
    typeId?: number
    type?: string
    statusId?: number
    status?: number
    startDate?: string
    scheduledTime?: string
    createdDate?: string
    modifiedDate?: string
    lastRunTime?: string
    nextRunTime?: string
    schedule?: {
      typeId?: number
      startDate?: string
      endDate?: string
      scheduledTime?: string
    }
  }>
  count?: number
  page?: number
  pageSize?: number
}

interface AutomationDetailResponse {
  id: string
  name: string
  description?: string
  key?: string
  statusId?: number
  status?: number
  startDate?: string
  lastRunTime?: string
  nextRunTime?: string
  createdDate?: string
  modifiedDate?: string
  schedule?: {
    typeId?: number
    startDate?: string
    endDate?: string
    scheduledTime?: string
    recurrence?: Record<string, unknown>
  }
  steps?: Array<{
    name: string
    step?: number
    activities?: Array<{
      id?: string
      name: string
      activityType?: string
      objectTypeId?: number
      status?: number
    }>
  }>
}

interface AutomationRunResponse {
  items?: Array<{
    id?: string
    automationId: string
    statusId?: number
    status?: number
    startDate?: string
    endDate?: string
    errorMessage?: string
    taskStatusMessages?: Array<{ message: string; detail?: string }>
  }>
  count?: number
}

export interface AutomationSummary {
  id: string
  name: string
  description?: string
  key?: string
  status: string
  lastRunTime?: string
  nextRunTime?: string
  createdDate?: string
  modifiedDate?: string
}

export interface AutomationDetail extends AutomationSummary {
  schedule?: {
    type?: number
    startDate?: string
    endDate?: string
    scheduledTime?: string
  }
  steps: Array<{
    name: string
    stepNumber?: number
    activities: Array<{ id?: string; name: string; type?: string; status?: number }>
  }>
}

export interface AutomationRun {
  id?: string
  status: string
  startDate?: string
  endDate?: string
  errorMessage?: string
}

/**
 * List automations in the current BU.
 */
export async function listAutomations(
  config: SfmcConfig,
  params: { search?: string; page?: number; pageSize?: number } = {}
): Promise<{ items: AutomationSummary[]; total: number }> {
  const { page = 1, pageSize = 25 } = params

  let url = `/automation/v1/automations?$page=${page}&$pageSize=${pageSize}&$orderBy=name`
  if (params.search?.trim()) {
    url += `&$filter=name%20like%20'${encodeURIComponent(params.search.trim())}'`
  }

  const data = await sfmcGet<AutomationListResponse>(config, url)

  return {
    items: (data.items ?? []).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      key: a.key,
      status: STATUS_MAP[a.statusId ?? a.status ?? -1] ?? `Unknown (${a.statusId ?? a.status})`,
      lastRunTime: a.lastRunTime,
      nextRunTime: a.nextRunTime,
      createdDate: a.createdDate,
      modifiedDate: a.modifiedDate,
    })),
    total: data.count ?? 0,
  }
}

/**
 * Get full automation detail including steps and activity sequence.
 */
export async function getAutomation(
  config: SfmcConfig,
  automationId: string
): Promise<AutomationDetail | null> {
  const data = await sfmcGet<AutomationDetailResponse>(
    config,
    `/automation/v1/automations/${automationId}`
  ).catch(() => null)

  if (!data) return null

  return {
    id: data.id,
    name: data.name,
    description: data.description,
    key: data.key,
    status: STATUS_MAP[data.statusId ?? data.status ?? -1] ?? 'Unknown',
    lastRunTime: data.lastRunTime,
    nextRunTime: data.nextRunTime,
    createdDate: data.createdDate,
    modifiedDate: data.modifiedDate,
    schedule: data.schedule
      ? {
          type: data.schedule.typeId,
          startDate: data.schedule.startDate,
          endDate: data.schedule.endDate,
          scheduledTime: data.schedule.scheduledTime,
        }
      : undefined,
    steps: (data.steps ?? []).map((s) => ({
      name: s.name,
      stepNumber: s.step,
      activities: (s.activities ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        type: a.activityType,
        status: a.status,
      })),
    })),
  }
}

/**
 * Get run history for a specific automation.
 */
export async function getAutomationRuns(
  config: SfmcConfig,
  automationId: string,
  params: { page?: number; pageSize?: number } = {}
): Promise<{ items: AutomationRun[]; total: number }> {
  const { page = 1, pageSize = 25 } = params

  const data = await sfmcGet<AutomationRunResponse>(
    config,
    `/automation/v1/automations/${automationId}/history?$page=${page}&$pageSize=${pageSize}`
  )

  return {
    items: (data.items ?? []).map((r) => ({
      id: r.id,
      status: STATUS_MAP[r.statusId ?? r.status ?? -1] ?? 'Unknown',
      startDate: r.startDate,
      endDate: r.endDate,
      errorMessage: r.errorMessage,
    })),
    total: data.count ?? 0,
  }
}
