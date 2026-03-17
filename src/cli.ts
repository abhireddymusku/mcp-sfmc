import { createClient } from './sdk.js'
import type { SfmcConfig } from './types.js'

function arg(argv: string[], flag: string): string | undefined {
  const i = argv.indexOf(flag)
  return i !== -1 && i + 1 < argv.length ? argv[i + 1] : undefined
}

function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag)
}

function num(argv: string[], flag: string): number | undefined {
  const v = arg(argv, flag)
  return v !== undefined ? parseInt(v, 10) : undefined
}

const HELP = `
mcp-sfmc CLI — query Salesforce Marketing Cloud from the terminal

Usage: mcp-sfmc [command] [options]

When run without flags (stdin is a pipe), starts the MCP server.

Commands:
  --list-journeys           List journeys (default status: Running)
    --status <status>       Running | Draft | Stopped | Paused
    --page <n>              Page number
    --page-size <n>         Results per page
    --search <term>         Filter by name

  --get-journey <id>        Get full journey detail
    --version <n>           Specific version number

  --search-content          Search Content Builder
    --query <term>          Search term
    --page <n>

  --get-content <id>        Get email HTML by asset ID
  --get-content-by-name <n> Get email HTML by exact name

  --list-automations        List Automation Studio automations
    --search <term>

  --list-sends              List recent email sends
    --status <status>

  --list-data-extensions    List Data Extensions
    --search <term>

  --list-business-units     List all child business units

  --help                    Show this help

Environment:
  SFMC_SUBDOMAIN, SFMC_CLIENT_ID, SFMC_CLIENT_SECRET, SFMC_MID
`.trim()

export async function runCli(config: SfmcConfig): Promise<void> {
  const argv = process.argv.slice(2)

  if (hasFlag(argv, '--help') || argv.length === 0) {
    console.log(HELP)
    return
  }

  const sfmc = createClient(config)

  let result: unknown

  if (hasFlag(argv, '--list-journeys')) {
    result = await sfmc.listJourneys({
      status: arg(argv, '--status') as 'Running' | 'Draft' | 'Stopped' | 'Paused' | undefined,
      search: arg(argv, '--search'),
      page: num(argv, '--page'),
      pageSize: num(argv, '--page-size'),
    })
  } else if (arg(argv, '--get-journey') !== undefined || hasFlag(argv, '--get-journey')) {
    const id = arg(argv, '--get-journey')
    if (!id) throw new Error('--get-journey requires an ID argument')
    result = await sfmc.getJourney(id, num(argv, '--version'))
  } else if (hasFlag(argv, '--search-content')) {
    result = await sfmc.searchContent({
      query: arg(argv, '--query'),
      page: num(argv, '--page'),
      pageSize: num(argv, '--page-size'),
    })
  } else if (arg(argv, '--get-content') !== undefined) {
    const id = arg(argv, '--get-content')
    if (!id) throw new Error('--get-content requires an asset ID')
    result = await sfmc.getContentById(parseInt(id, 10))
  } else if (arg(argv, '--get-content-by-name') !== undefined) {
    const name = arg(argv, '--get-content-by-name')
    if (!name) throw new Error('--get-content-by-name requires a name argument')
    result = await sfmc.getContentByName(name)
  } else if (hasFlag(argv, '--list-automations')) {
    result = await sfmc.listAutomations({ search: arg(argv, '--search') })
  } else if (hasFlag(argv, '--list-sends')) {
    result = await sfmc.listSends({ status: arg(argv, '--status') })
  } else if (hasFlag(argv, '--list-data-extensions')) {
    result = await sfmc.listDataExtensions({ search: arg(argv, '--search') })
  } else if (hasFlag(argv, '--list-business-units')) {
    result = await sfmc.listBusinessUnits()
  } else {
    console.error(`Unknown command. Run with --help to see available commands.`)
    process.exit(1)
  }

  console.log(JSON.stringify(result, null, 2))
}
