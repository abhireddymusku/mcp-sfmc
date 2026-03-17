import { sfmcGet } from '../client.js'
import type { SfmcConfig } from '../types.js'

interface DEListResponse {
  items?: Array<{
    customerKey: string
    name: string
    description?: string
    fields?: Array<{
      name: string
      fieldType: string
      isPrimaryKey: boolean
      isRequired: boolean
      maxLength?: number
    }>
  }>
  count?: number
}


/**
 * List all Data Extensions accessible in the current BU.
 */
export async function listDataExtensions(
  config: SfmcConfig,
  params: { search?: string; page?: number; pageSize?: number } = {}
): Promise<Array<{
  key: string
  name: string
  description?: string
  fieldCount?: number
  fields?: Array<{
    name: string
    fieldType: string
    isPrimaryKey: boolean
    isRequired: boolean
    maxLength?: number
  }>
}>> {
  const { search, page = 1, pageSize = 50 } = params

  let url = `/data/v1/customobjectdata?$page=${page}&$pageSize=${pageSize}`
  if (search?.trim()) {
    url += `&$filter=name%20like%20'${encodeURIComponent(search.trim())}'`
  }

  const data = await sfmcGet<DEListResponse>(config, url)

  return (data.items ?? []).map((de) => ({
    key: de.customerKey,
    name: de.name,
    description: de.description,
    fieldCount: de.fields?.length,
    fields: de.fields?.map((f) => ({
      name: f.name,
      fieldType: f.fieldType,
      isPrimaryKey: f.isPrimaryKey,
      isRequired: f.isRequired,
      maxLength: f.maxLength,
    })),
  }))
}

/**
 * Get the schema (field definitions) of a specific Data Extension.
 * Useful for discovering available merge tag field names.
 */
export async function getDataExtensionSchema(
  config: SfmcConfig,
  key: string
): Promise<{
  key: string
  name: string
  fields: Array<{
    name: string
    fieldType: string
    isPrimaryKey: boolean
    isRequired: boolean
    maxLength?: number
  }>
} | null> {
  interface SchemaResponse {
    customerKey: string
    name: string
    fields?: Array<{
      name: string
      fieldType: string
      isPrimaryKey: boolean
      isRequired: boolean
      maxLength?: number
    }>
  }

  const data = await sfmcGet<SchemaResponse>(
    config,
    `/data/v1/customobjectdata/key/${encodeURIComponent(key)}/schema`
  ).catch(() => null)

  if (!data) return null

  return {
    key: data.customerKey,
    name: data.name,
    fields: (data.fields ?? []).map((f) => ({
      name: f.name,
      fieldType: f.fieldType,
      isPrimaryKey: f.isPrimaryKey,
      isRequired: f.isRequired,
      maxLength: f.maxLength,
    })),
  }
}
