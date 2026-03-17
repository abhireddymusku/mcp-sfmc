/**
 * Tests for the HTML slot/block resolution logic.
 * Run via: npm test (builds first then runs node --test dist/lib/html-resolver.test.js)
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractSlotHtml, extractBlockHtml, resolveAssetHtml } from './html-resolver.js'
import type { SfmcContentAsset } from '../types.js'

// ─── extractSlotHtml ─────────────────────────────────────────────────────────

test('extractSlotHtml: returns superContent when present', () => {
  const slot = { superContent: '<p>super</p>', content: '<p>content</p>' }
  assert.equal(extractSlotHtml(slot as never), '<p>super</p>')
})

test('extractSlotHtml: falls back to content when no superContent', () => {
  const slot = { content: '<p>hello</p>' }
  assert.equal(extractSlotHtml(slot as never), '<p>hello</p>')
})

test('extractSlotHtml: returns empty string when nothing present', () => {
  assert.equal(extractSlotHtml({} as never), '')
})

test('extractSlotHtml: assembles multiple blocks in order', () => {
  const slot = {
    blocks: {
      a: { content: '<p>A</p>' },
      b: { content: '<p>B</p>' },
    },
  }
  const html = extractSlotHtml(slot as never)
  assert.ok(html.includes('<p>A</p>'), 'should include block A')
  assert.ok(html.includes('<p>B</p>'), 'should include block B')
})

// ─── extractBlockHtml ────────────────────────────────────────────────────────

test('extractBlockHtml: returns superContent when present', () => {
  const block = { superContent: '<p>super</p>', content: '<p>other</p>' }
  assert.equal(extractBlockHtml(block as never), '<p>super</p>')
})

test('extractBlockHtml: returns content for simple block', () => {
  const block = { content: '<td>Hello</td>' }
  assert.equal(extractBlockHtml(block as never), '<td>Hello</td>')
})

test('extractBlockHtml: returns empty string when block is empty', () => {
  assert.equal(extractBlockHtml({} as never), '')
})

test('extractBlockHtml: assembles nested slot content', () => {
  const block = {
    content: '<table>',
    slots: { main: { content: '<td>Nested</td>' } },
  }
  const html = extractBlockHtml(block as never)
  assert.ok(html.includes('<td>Nested</td>'), 'should include nested slot content')
})

test('extractBlockHtml: combines block content + nested slots', () => {
  const block = {
    content: '<wrapper>',
    slots: { body: { content: '<inner/>' } },
  }
  const html = extractBlockHtml(block as never)
  assert.ok(html.includes('<wrapper>'))
  assert.ok(html.includes('<inner/>'))
})

// ─── resolveAssetHtml ────────────────────────────────────────────────────────

test('resolveAssetHtml: returns html view content for simple asset', () => {
  const asset: Partial<SfmcContentAsset> = {
    id: 1,
    name: 'test',
    assetType: { name: 'htmlemail', id: 208 },
    views: { html: { content: '<html><body>Hello</body></html>' } },
    createdDate: '',
    modifiedDate: '',
  }
  const html = resolveAssetHtml(asset as SfmcContentAsset)
  assert.ok(html.includes('Hello'))
})

test('resolveAssetHtml: falls back to asset.content when views missing', () => {
  const asset: Partial<SfmcContentAsset> = {
    id: 2,
    name: 'bare',
    assetType: { name: 'htmlemail', id: 208 },
    content: '<p>bare content</p>',
    createdDate: '',
    modifiedDate: '',
  }
  assert.equal(resolveAssetHtml(asset as SfmcContentAsset), '<p>bare content</p>')
})

test('resolveAssetHtml: assembles slot content for template asset', () => {
  const asset: Partial<SfmcContentAsset> = {
    id: 3,
    name: 'template',
    assetType: { name: 'templatebasedemail', id: 207 },
    views: {
      html: {
        content: '%%slot "main"%%',
        slots: {
          main: { content: '<div>Slot Content</div>' },
        },
      },
    },
    createdDate: '',
    modifiedDate: '',
  }
  const html = resolveAssetHtml(asset as SfmcContentAsset)
  assert.ok(html.includes('Slot Content'), 'should include slot content')
})

test('resolveAssetHtml: returns complete HTML doc as-is when no slot placeholders', () => {
  const fullHtml = '<!DOCTYPE html><html><body>Complete</body></html>'
  const asset: Partial<SfmcContentAsset> = {
    id: 4,
    name: 'complete',
    assetType: { name: 'templatebasedemail', id: 207 },
    views: {
      html: {
        content: fullHtml,
        slots: { main: { content: '<div>ignored</div>' } },
      },
    },
    createdDate: '',
    modifiedDate: '',
  }
  const html = resolveAssetHtml(asset as SfmcContentAsset)
  assert.ok(html.includes('Complete'))
  assert.ok(!html.includes('ignored'), 'should not include slot content when template is a complete doc')
})

test('resolveAssetHtml: returns empty string when no content anywhere', () => {
  const asset: Partial<SfmcContentAsset> = {
    id: 5,
    name: 'empty',
    assetType: { name: 'htmlemail', id: 208 },
    createdDate: '',
    modifiedDate: '',
  }
  assert.equal(resolveAssetHtml(asset as SfmcContentAsset), '')
})
