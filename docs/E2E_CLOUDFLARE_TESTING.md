# End-to-End Cloudflare Testing

This runbook verifies the full StaticDrop path:

1. Deploy the Worker to Cloudflare.
2. Store uploaded files in R2.
3. Serve the uploaded site through the public `/s/:slug/` URL.
4. Publish through the same MCP package Codex uses.

## Prerequisites

- Cloudflare account with Workers and R2 enabled.
- Wrangler logged in locally.
- Node 20+.
- A unique upload token.

```bash
npx wrangler login
node --version
openssl rand -hex 32
```

Use the generated token as `UPLOAD_TOKEN` in Cloudflare and `STATICDROP_TOKEN` locally.

## 1. Install And Check Locally

From the repo root:

```bash
npm install
npm --prefix packages/mcp test
npm --prefix packages/worker run typecheck
npm audit --omit=dev
```

Expected result:

- MCP tests pass.
- Worker TypeScript check passes.
- Production dependency audit reports no vulnerabilities.

## 2. Create R2 Bucket

```bash
cd packages/worker
npx wrangler r2 bucket create staticdrop-sites
```

If the bucket already exists, keep using it. The Worker binding in `wrangler.toml` expects:

```toml
binding = "SITES"
bucket_name = "staticdrop-sites"
```

## 3. Configure Upload Secret

```bash
cd packages/worker
npx wrangler secret put UPLOAD_TOKEN
```

Paste the token generated during prerequisites.

Optional: if using a custom domain, set `PUBLIC_BASE_URL` in `wrangler.toml` or Cloudflare dashboard vars.

## 4. Deploy Worker

```bash
cd packages/worker
npm run deploy
```

Save the deployed Worker URL from Wrangler output. It should look like:

```text
https://staticdrop.<account-subdomain>.workers.dev
```

## 5. Smoke Test Worker Health

```bash
export STATICDROP_ENDPOINT="https://staticdrop.<account-subdomain>.workers.dev"
curl -fsS "$STATICDROP_ENDPOINT/health"
```

Expected response:

```json
{
  "ok": true
}
```

## 6. Upload With The Raw HTTP API

From the repo root:

```bash
export STATICDROP_TOKEN="paste-upload-token-here"
CONTENT="$(base64 < examples/tiny-site/index.html | tr -d '\n')"

curl -fsS -X POST "$STATICDROP_ENDPOINT/api/sites" \
  -H "Authorization: Bearer $STATICDROP_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"slug\":\"e2e-http\",\"files\":[{\"path\":\"index.html\",\"contentBase64\":\"$CONTENT\",\"contentType\":\"text/html; charset=utf-8\"}]}"
```

Expected response includes:

```json
{
  "slug": "e2e-http",
  "url": "https://staticdrop.<account-subdomain>.workers.dev/s/e2e-http/",
  "files": 1
}
```

Then verify the public URL:

```bash
curl -fsS "$STATICDROP_ENDPOINT/s/e2e-http/" | head
```

Expected result: the response contains `StaticDrop Example`.

## 7. Upload Through The MCP Publisher Package

Build the MCP package:

```bash
npm --prefix packages/mcp run build
```

Run a direct publisher call against the deployed Worker:

```bash
node --input-type=module <<'EOF'
import { publishStaticSite } from "./packages/mcp/dist/publisher.js";

const result = await publishStaticSite({
  endpoint: process.env.STATICDROP_ENDPOINT,
  token: process.env.STATICDROP_TOKEN,
  rootDir: "examples/tiny-site",
  slug: "e2e-mcp"
});

console.log(result.url);
EOF
```

Then verify both files are served:

```bash
curl -fsS "$STATICDROP_ENDPOINT/s/e2e-mcp/" | grep "StaticDrop works"
curl -fsS "$STATICDROP_ENDPOINT/s/e2e-mcp/styles.css" | grep "font-family"
```

## 8. Test Through Codex

Make sure the local plugin has access to the same environment variables:

```bash
export STATICDROP_ENDPOINT="https://staticdrop.<account-subdomain>.workers.dev"
export STATICDROP_TOKEN="paste-upload-token-here"
```

Install or load the local plugin from:

```text
/home/jaw/code/staticdrop/plugins/staticdrop
```

Ask Codex:

```text
Publish /home/jaw/code/staticdrop/examples/tiny-site with StaticDrop using slug e2e-codex.
```

Expected result: Codex calls `publish_static_site` and returns:

```text
https://staticdrop.<account-subdomain>.workers.dev/s/e2e-codex/
```

Open or curl that URL and confirm the example page loads.

## Negative Checks

Run these after the happy path:

```bash
curl -i -X POST "$STATICDROP_ENDPOINT/api/sites" \
  -H "Authorization: Bearer wrong-token" \
  -H "Content-Type: application/json" \
  --data '{"files":[]}'
```

Expected: `401 Unauthorized`.

```bash
curl -i -X POST "$STATICDROP_ENDPOINT/api/sites" \
  -H "Authorization: Bearer $STATICDROP_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"slug":"../bad","files":[]}'
```

Expected: `400 Bad Request`.

```bash
curl -i "$STATICDROP_ENDPOINT/s/not-a-real-site/"
```

Expected: `404 Not Found`.

## Cleanup

For a disposable test deployment:

```bash
cd packages/worker
npx wrangler delete
npx wrangler r2 bucket delete staticdrop-sites
```

Do not delete the bucket if it contains real shared previews.

