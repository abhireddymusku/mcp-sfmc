# Contributing to mcp-sfmc

Issues and pull requests are welcome.

## Development setup

```bash
git clone https://github.com/emailforge/mcp-sfmc.git
cd mcp-sfmc
npm install
npm run build
```

## Running locally

```bash
SFMC_SUBDOMAIN=xxx SFMC_CLIENT_ID=xxx SFMC_CLIENT_SECRET=xxx node dist/index.js
```

Or use the `.mcp.json` in this repo — fill in your credentials and restart Claude Code.

## Running tests

```bash
npm test
```

Tests cover the HTML slot/block resolution logic that assembles template-based emails.

## Adding a new tool

1. Add the implementation function in the relevant file under `src/tools/`
2. Add the tool definition to the `TOOLS` array in `src/index.ts`
3. Add a dispatcher case in the `dispatch` function in `src/index.ts`
4. Add the tool to the table in `README.md`
5. Add input validation using the `req()` helper for required arguments

## Conventions

- All SFMC REST calls go through `sfmcGet`, `sfmcPost`, `sfmcPatch`, or `sfmcDelete` in `src/client.ts` — never call `fetch` directly in tool files
- Return plain serialisable objects from tool functions — no classes
- Errors thrown from tools are caught by the dispatcher and returned as `isError: true` MCP responses — let them propagate naturally
- Keep tool descriptions precise: Claude uses them to decide which tool to call

## Pull request checklist

- [ ] `npm run build` passes with no TypeScript errors
- [ ] `npm test` passes
- [ ] New tool documented in `README.md`
- [ ] No credentials, tokens, or `.env` files committed
