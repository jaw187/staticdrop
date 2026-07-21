#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { normalizeSlug, publishStaticSite } from "./publisher.js";

const server = new McpServer({
  name: "staticdrop",
  version: "0.1.0"
});

server.tool(
  "publish_static_site",
  "Publish a local static HTML directory to StaticDrop and return a public URL.",
  {
    rootDir: z.string().describe("Absolute or relative path to the static site directory. Must contain index.html."),
    slug: z.string().optional().describe("Optional lowercase URL slug."),
    includeHidden: z.boolean().optional().describe("Include dotfiles. Defaults to false.")
  },
  async ({ rootDir, slug, includeHidden }) => {
    const endpoint = process.env.STATICDROP_ENDPOINT;
    const token = process.env.STATICDROP_TOKEN;

    if (!endpoint || !token) {
      throw new Error("Set STATICDROP_ENDPOINT and STATICDROP_TOKEN before using StaticDrop.");
    }

    const result = await publishStaticSite({
      endpoint,
      token,
      rootDir,
      slug: normalizeSlug(slug),
      includeHidden
    });

    return {
      content: [
        {
          type: "text",
          text: `Published ${result.files} files to ${result.url}`
        }
      ]
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);

