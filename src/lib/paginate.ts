/**
 * Async generator that auto-paginates any list function.
 * Yields individual items across all pages.
 *
 * @example
 * for await (const journey of paginate(sfmc.listJourneys, { status: 'Running' })) {
 *   console.log(journey.name)
 * }
 */
export async function* paginate<TItem, TParams extends Record<string, unknown>>(
  fn: (params: TParams & { page: number; pageSize: number }) => Promise<{ items: TItem[]; total: number }>,
  params: TParams & { pageSize?: number } = {} as TParams,
): AsyncGenerator<TItem> {
  const pageSize = (params.pageSize as number | undefined) ?? 50
  let page = 1
  let fetched = 0
  let total = Infinity

  while (fetched < total) {
    const result = await fn({ ...params, page, pageSize })
    if (result.total !== undefined && Number.isFinite(result.total)) total = result.total
    for (const item of result.items) {
      fetched++
      yield item
    }
    if (result.items.length < pageSize) break
    page++
  }
}
