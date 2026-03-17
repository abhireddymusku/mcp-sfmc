/**
 * HTML resolution helpers for SFMC Content Builder assets.
 *
 * Template-based emails store content in a nested slots → blocks structure.
 * These functions walk that tree recursively and assemble the final HTML string
 * that a subscriber would receive.
 */
import type { SfmcContentAsset, SfmcContentSlot, SfmcContentBlock } from '../types.js'

export function extractSlotHtml(slot: SfmcContentSlot): string {
  if (slot.superContent) return slot.superContent
  if (slot.content) return slot.content
  if (!slot.blocks) return ''
  return Object.values(slot.blocks).map(extractBlockHtml).join('\n')
}

export function extractBlockHtml(block: SfmcContentBlock): string {
  if (block.superContent) return block.superContent
  if (block.slots && Object.keys(block.slots).length > 0) {
    const nested = Object.values(block.slots).map(extractSlotHtml).join('\n')
    if (block.content && nested) return block.content + '\n' + nested
    return nested || block.content || ''
  }
  return block.content ?? ''
}

export function resolveAssetHtml(asset: SfmcContentAsset): string {
  const htmlView = asset.views?.html
  if (!htmlView?.slots || Object.keys(htmlView.slots).length === 0) {
    return htmlView?.content ?? asset.content ?? ''
  }
  const templateHtml = htmlView.content ?? ''
  const slotHtmlParts = Object.values(htmlView.slots).map(extractSlotHtml)
  const assembledSlots = slotHtmlParts.filter(Boolean).join('\n')

  // If the template is a complete HTML document without slot placeholders, use it as-is
  if (templateHtml.toLowerCase().includes('<html') && !templateHtml.includes('%%slot')) {
    return templateHtml
  }
  return assembledSlots || templateHtml || asset.content || ''
}
