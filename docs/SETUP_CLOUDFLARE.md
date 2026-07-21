# Cloudflare Setup

## Requirements

- Cloudflare account
- Wrangler CLI
- Node 20+

## Deploy

```bash
cd packages/worker
npm install
npx wrangler r2 bucket create staticdrop-sites
npx wrangler secret put UPLOAD_TOKEN
npm run deploy
```

The default `wrangler.toml` binds the R2 bucket as `SITES`.

## Local Development

Create `packages/worker/.dev.vars`:

```text
UPLOAD_TOKEN=dev-token
PUBLIC_BASE_URL=http://localhost:8787
```

Then run:

```bash
cd packages/worker
npm run dev
```

Publish the example site through the MCP client or with curl:

```bash
curl -X POST http://localhost:8787/api/sites \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  --data '{"files":[{"path":"index.html","contentBase64":"PGgxPkhlbGxvPC9oMT4=","contentType":"text/html; charset=utf-8"}]}'
```

## Custom Domains

After deployment, add a custom domain in Cloudflare Workers routes or custom domains. Set `PUBLIC_BASE_URL` if the Worker needs to return that domain instead of the request origin.

