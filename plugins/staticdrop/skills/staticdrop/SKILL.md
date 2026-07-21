---
name: staticdrop
description: Publish generated static HTML directories with StaticDrop and return the hosted URL.
---

# StaticDrop

Use this skill when the user asks to host, publish, share, preview, or make a URL for generated static HTML content.

## Workflow

1. Make sure the requested directory is static and contains a root `index.html`.
2. Build the site first if the source is a framework app and the static output is not already present.
3. Call the `publish_static_site` MCP tool with the final output directory.
4. Return the URL from the tool response.

## Guardrails

- Do not publish secrets, `.env` files, private source directories, or dependency folders.
- Ask before publishing if the folder appears to contain private personal data.
- Prefer a user-provided slug when they ask for a named URL.
- For throwaway previews, omit `slug` and let StaticDrop generate one.

