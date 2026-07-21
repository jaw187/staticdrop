# StaticDrop

StaticDrop is a tiny "pastebin for static sites" built for Codex and ChatGPT-style coding workflows.

Tell Codex to publish a generated HTML folder, and the local MCP tool uploads it to a Cloudflare Worker backed by R2. The Worker returns a public URL like:

```text
https://staticdrop.example.workers.dev/s/abc123/
```

## What Is In This Repo

- `packages/worker` - Cloudflare Worker that accepts uploads and serves static files.
- `packages/mcp` - MCP server exposing a `publish_static_site` tool for Codex.
- `plugins/staticdrop` - Local Codex plugin manifest and skill instructions.
- `examples/tiny-site` - Minimal site you can publish during setup.
- `docs` - Deployment, architecture, and plugin setup notes.

## Why This Shape

The hosting problem is split into two clear parts:

1. A public upload API that stores and serves files.
2. A local Codex tool that can read generated files from disk and call that API.

That keeps Codex away from cloud credentials. Codex only needs a single publish endpoint and upload token.

## Quick Start

Deploy the Worker:

```bash
cd packages/worker
npm install
npx wrangler r2 bucket create staticdrop-sites
npx wrangler secret put UPLOAD_TOKEN
npm run deploy
```

Configure the local MCP publisher:

```bash
cd packages/mcp
npm install
npm run build
export STATICDROP_ENDPOINT="https://your-worker.workers.dev"
export STATICDROP_TOKEN="same-token-as-upload-token"
node dist/index.js
```

Install the Codex plugin by pointing Codex at `plugins/staticdrop/`, then ask:

```text
Publish examples/tiny-site with StaticDrop.
```

## API

Upload:

```http
POST /api/sites
Authorization: Bearer <UPLOAD_TOKEN>
Content-Type: application/json
```

Body:

```json
{
  "slug": "optional-slug",
  "files": [
    {
      "path": "index.html",
      "contentBase64": "PGgxPkhlbGxvPC9oMT4=",
      "contentType": "text/html; charset=utf-8"
    }
  ]
}
```

Response:

```json
{
  "slug": "optional-slug",
  "url": "https://your-worker.workers.dev/s/optional-slug/",
  "files": 1
}
```

## Security Defaults

- Uploads require a bearer token.
- Public URLs are read-only.
- Slugs are validated to prevent path traversal.
- Uploaded file paths are normalized and must remain inside the site.
- Per-upload limits are enforced in the Worker and MCP client.

## Docs

- [Architecture](docs/ARCHITECTURE.md)
- [Cloudflare Setup](docs/SETUP_CLOUDFLARE.md)
- [Codex Plugin Setup](docs/CODEX_PLUGIN.md)
