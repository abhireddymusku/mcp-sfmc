# mcp-sfmc

> Read-only MCP server for Salesforce Marketing Cloud — connect any MCP-compatible AI assistant to Content Builder, Journey Builder, Automation Studio, SMS, Push, and more. Switch between business units mid-conversation.

[![npm](https://img.shields.io/npm/v/sfmc-mcp)](https://www.npmjs.com/package/sfmc-mcp)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## What it does

`sfmc-mcp` is a [Model Context Protocol](https://modelcontextprotocol.io) server that exposes your Salesforce Marketing Cloud account as callable tools for any MCP-compatible AI assistant — Claude, Cursor, Windsurf, or your own agent.

**Read-only by design** — all tools are GET operations. No data is created, modified, or deleted. No individual subscriber PII is returned.

Once connected, you can ask your AI assistant things like:

- *"Show me the HTML for the email named 'Welcome Series - Email 1'"*
- *"Which journeys are currently running and what emails are in each one?"*
- *"What automations ran in the last 7 days and did any fail?"*
- *"What fields are in the Customer Profile data extension?"*
- *"List our sender domains and flag any with DKIM/SPF issues"*

## Quick start

### 1. Set up an Installed Package in SFMC

1. In SFMC, go to **Setup → Apps → Installed Packages → New**
2. Name it `MCP Server` (or anything you like)
3. Add a **Server-to-Server** API integration component
4. Grant the following permissions:
   - **Email**: Read
   - **Assets**: Documents and Images Read
   - **Automation**: Read
   - **Journeys**: Read
   - **Data Extensions**: Read
   - **Tracking Events**: Read (for send performance)
   - **SMS**: Read (optional)
   - **Push**: Read (optional)
5. Save — note your **Client ID**, **Client Secret**, and **Subdomain** (the part before `.auth.marketingcloudapis.com`)

### 2. Configure your MCP client

**Claude Desktop** — add to `~/Library/Application Support/Claude/claude_desktop_config.json` (or the equivalent config file for your MCP client):

```json
{
  "mcpServers": {
    "sfmc": {
      "command": "npx",
      "args": ["-y", "sfmc-mcp"],
      "env": {
        "SFMC_SUBDOMAIN": "your-subdomain",
        "SFMC_CLIENT_ID": "your-client-id",
        "SFMC_CLIENT_SECRET": "your-client-secret",
        "SFMC_MID": "optional-child-bu-mid"
      }
    }
  }
}
```

**Claude Code / Cursor / other MCP clients** — add to your project's `.mcp.json` or equivalent:

```json
{
  "mcpServers": {
    "sfmc": {
      "command": "npx",
      "args": ["-y", "sfmc-mcp"],
      "env": {
        "SFMC_SUBDOMAIN": "your-subdomain",
        "SFMC_CLIENT_ID": "your-client-id",
        "SFMC_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

**Environment variables:**

| Variable | Required | Description |
|---|---|---|
| `SFMC_SUBDOMAIN` | ✓ | Your SFMC subdomain (e.g. `mc563885gzs27c5t9`) |
| `SFMC_CLIENT_ID` | ✓ | Installed Package Client ID |
| `SFMC_CLIENT_SECRET` | ✓ | Installed Package Client Secret |
| `SFMC_MID` | — | Child BU MID — scope all requests to a specific business unit |

### 3. Restart your MCP client — you're done

## Available tools (46 total)

### Business Units

| Tool | Description |
|---|---|
| `sfmc_list_business_units` | List all child BUs with MID, name, and parent |
| `sfmc_set_bu` | Switch the active BU for this session (no restart required) |
| `sfmc_get_current_bu` | Show which BU MID is currently active |

### Content Builder

| Tool | Description |
|---|---|
| `sfmc_search_content` | Search for HTML email assets by name |
| `sfmc_get_content` | Fetch full rendered HTML by asset ID |
| `sfmc_get_content_by_name` | Fetch full rendered HTML by exact asset name |
| `sfmc_list_folders` | List Content Builder folder tree |
| `sfmc_get_folder` | Get a specific folder by ID |
| `sfmc_list_content_by_folder` | List email assets within a specific folder |

### Journey Builder

| Tool | Description |
|---|---|
| `sfmc_list_journeys` | List journeys filtered by status (Running / Draft / Stopped / Paused) |
| `sfmc_get_journey` | Full journey detail — activity sequence, entry source, email asset IDs, population stats |
| `sfmc_get_journey_stats` | Per-activity send stats — sent, opened, clicked, bounced, opted-out |
| `sfmc_diff_journey_versions` | Compare two versions — see what activities were added, removed, or changed |
| `sfmc_get_journey_full` | **Full picture in one call** — journey + entry automation/DE + all email HTML + stats |

### Send Performance

| Tool | Description |
|---|---|
| `sfmc_list_sends` | List recent email sends with basic stats |
| `sfmc_get_send_performance` | Detailed metrics with computed open/click/bounce rates |
| `sfmc_get_tracking_summary` | Tracking summary via SFMC Data Views |

### Data Extensions

| Tool | Description |
|---|---|
| `sfmc_list_data_extensions` | List DEs with name and field count |
| `sfmc_get_de_schema` | Field schema — names, types, primary keys (useful for merge tag discovery) |
| `sfmc_get_de_usage` | **Where is this DE used?** — journeys using it as entry source + automations writing to it |

### Automation Studio

| Tool | Description |
|---|---|
| `sfmc_list_automations` | List automations with status, schedule, and run times |
| `sfmc_get_automation` | Full automation detail including steps, activity sequence, and linked journey IDs |
| `sfmc_get_automation_runs` | Run history for a specific automation |
| `sfmc_get_automation_full` | **Full picture in one call** — automation + last run + all linked journey details |

### Reverse Lookups

Cross-object scans — these make multiple API calls and may take a few seconds on large accounts.

| Tool | Description |
|---|---|
| `sfmc_find_email_usage` | Given a content asset ID, find all active journeys that send it |
| `sfmc_get_de_usage` | Given a DE key, find all journeys using it as entry source + automations writing to it |

### Campaigns

| Tool | Description |
|---|---|
| `sfmc_list_campaigns` | List SFMC campaigns (tags/groupings for assets) |
| `sfmc_get_campaign` | Get a single campaign by ID |
| `sfmc_get_campaign_assets` | List all assets (emails, automations, journeys) linked to a campaign |

### Transactional Messaging

| Tool | Description |
|---|---|
| `sfmc_list_transactional_definitions` | List transactional email send definitions |
| `sfmc_get_transactional_definition` | Get a single transactional definition by key |

### SMS

| Tool | Description |
|---|---|
| `sfmc_list_sms_definitions` | List SMS send definitions with message templates and short codes |
| `sfmc_get_sms_definition` | Get a single SMS definition by key |
| `sfmc_list_sms_keywords` | List SMS opt-in keywords and their auto-responses |

### Push Notifications

| Tool | Description |
|---|---|
| `sfmc_list_push_apps` | List MobilePush apps configured in this BU |
| `sfmc_get_push_app` | Get full push app detail including badge/sound config |
| `sfmc_list_push_messages` | List push messages for an app with aggregate send/open stats |

### Seed Lists

| Tool | Description |
|---|---|
| `sfmc_list_seed_lists` | List all seed lists (metadata and address count — no individual addresses) |
| `sfmc_get_seed_list` | Get a single seed list by ID |

### Deliverability

| Tool | Description |
|---|---|
| `sfmc_list_sender_domains` | List authenticated sender domains with DKIM/SPF verification status |
| `sfmc_list_suppression_lists` | List suppression lists with metadata and counts (no individual addresses) |
| `sfmc_get_suppression_list` | Get a single suppression list by ID |

### Contacts

| Tool | Description |
|---|---|
| `sfmc_get_contact_schema` | Get contact attribute sets and field definitions (no individual contact data) |
| `sfmc_get_contact_journey_membership` | Get which journeys a contact is active in (returns journey names, not PII) |

### Platform

| Tool | Description |
|---|---|
| `sfmc_get_api_endpoints` | List all REST API endpoints available for this account/edition |
| `sfmc_get_audit_log` | Get recent audit events — who changed what and when |

## Example prompts

```
"Fetch the HTML for the email named 'Welcome Series - Email 1' from Content Builder"

"List all running journeys and tell me which email activities are in the
 'Summer Campaign 2026' journey"

"Get the journey stats for journey ID abc123 version 3 —
 which email had the best open rate?"

"What fields are available in the 'Customer Profile' data extension?"

"Show me all automations that have errored in the last week"

"List our SMS send definitions and their short codes"

"Are all our sender domains verified for DKIM and SPF?"

"Who made changes to the account in the last 24 hours? Show me the audit log."

"Which journeys is subscriber key 'abc-123' currently active in?"
```

## Multi-BU setup

If your SFMC org has multiple business units, you have two options:

**Single BU** — set `SFMC_MID` to your target child BU MID. All requests are scoped to that BU.

**Multi-BU** — omit `SFMC_MID`. Then in conversation:
1. `sfmc_list_business_units` — see all available BUs and their MIDs
2. `sfmc_set_bu` with the target MID — scope all subsequent requests to that BU
3. `sfmc_get_current_bu` — confirm which BU is active
4. `sfmc_set_bu` again to switch to a different BU at any time — no restart needed

## Using as a Node.js SDK (no LLM required)

You can use the same tools directly in any Node.js project — no MCP client or LLM needed.

```bash
npm install sfmc-mcp
```

```typescript
import { createClient } from 'sfmc-mcp/sdk'

const sfmc = createClient({
  subdomain: 'mc563885gzs27c5t9',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
})

// Fetch email HTML from Content Builder
const email = await sfmc.getContentByName('Welcome Series - Email 1')
console.log(email?.html)

// List running journeys
const { items } = await sfmc.listJourneys({ status: 'Running' })

// Get per-email stats for a journey
const stats = await sfmc.getJourneyStats(items[0].id, items[0].version)

// Switch to a child BU
const bu2 = sfmc.withMid('12345678')
const bu2Journeys = await bu2.listJourneys()
```

All 42 tools are available as methods. Token auth and rate-limit retry are handled automatically. Full TypeScript types are exported from `sfmc-mcp/sdk`.

## Notes on template-based emails

SFMC's template-based emails store content in nested slot/block structures. `sfmc_get_content` and `sfmc_get_content_by_name` fully resolve these slots recursively and return the complete rendered HTML — the same as what a subscriber receives.

## Rate limiting

The server automatically handles SFMC's rate limits. On a `429 Too Many Requests` response it backs off exponentially (up to 30 seconds) and retries up to 3 times before surfacing an error.

## Send performance and Data Views

`sfmc_get_tracking_summary` uses SFMC's tracking Data Views (`_Sent`, `_Open`, `_Click`, `_Bounce`, `_Unsubscribe`). These require your Installed Package to have **Tracking Events: Read** permission and **Data Views** access enabled on the connected BU.

## Contributing

Issues and PRs are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

To test locally:

```bash
npm install
npm run build

SFMC_SUBDOMAIN=xxx SFMC_CLIENT_ID=xxx SFMC_CLIENT_SECRET=xxx node dist/index.js
```

Run unit tests:

```bash
npm test
```

## License

MIT — see [LICENSE](LICENSE).
