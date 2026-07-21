# Codex Plugin Setup

The `plugins/staticdrop/` directory contains a local Codex plugin that registers the StaticDrop MCP server and includes a skill describing when to use it.

## Configure

Build the MCP package:

```bash
cd packages/mcp
npm install
npm run build
```

Set environment variables wherever your Codex plugin runner reads them:

```bash
export STATICDROP_ENDPOINT="https://your-worker.workers.dev"
export STATICDROP_TOKEN="same-token-as-worker-upload-token"
```

Install or load the local plugin from:

```text
/home/jaw/code/staticdrop/plugins/staticdrop
```

## Tool

The plugin exposes:

```text
publish_static_site
```

Inputs:

- `rootDir` - Directory containing the generated static site.
- `slug` - Optional URL slug.
- `includeHidden` - Optional, defaults to false.

Example user prompt:

```text
Publish /tmp/generated-site with StaticDrop and give me the URL.
```
