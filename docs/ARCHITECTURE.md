# Architecture

StaticDrop has one public runtime and one local automation runtime.

## Public Runtime

The Cloudflare Worker exposes:

- `POST /api/sites` for authenticated uploads.
- `GET /s/:slug/...` for public static file delivery.
- `GET /health` for deploy checks.

Files are stored in R2 under:

```text
sites/<slug>/<relative-path>
```

The Worker serves `/s/<slug>/` as `/s/<slug>/index.html`, and also supports directory fallback such as `/s/<slug>/docs/` to `docs/index.html`.

## Local Runtime

The MCP server runs on the user's machine with access to generated files. It:

- Walks a requested directory.
- Filters unsafe, hidden, very large, or dependency/build-cache files.
- Encodes files as base64.
- Sends one JSON upload to the Worker.
- Returns the final public URL to Codex.

## Trust Boundary

Codex does not need a Cloudflare API token. The only secret available to the MCP process is `STATICDROP_TOKEN`, which maps to the Worker's upload bearer token.

## Production Notes

For a shared hosted service, put rate limiting in front of `POST /api/sites`, add per-token quotas, and consider abuse reporting. For a personal or team tool, the included bearer-token gate is usually enough to make the workflow useful.

