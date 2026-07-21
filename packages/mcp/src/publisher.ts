import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export type SiteFile = {
  path: string;
  contentBase64: string;
  contentType: string;
  bytes: number;
};

export type PublishOptions = {
  endpoint: string;
  token: string;
  rootDir: string;
  slug?: string;
  includeHidden?: boolean;
};

export type PublishResult = {
  slug: string;
  url: string;
  files: number;
};

const MAX_FILES = 250;
const MAX_FILE_BYTES = 2_000_000;
const MAX_UPLOAD_BYTES = 25_000_000;

const SKIP_DIRS = new Set([".git", ".next", ".turbo", "coverage", "dist", "node_modules"]);

const MIME_BY_EXTENSION: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2"
};

export async function publishStaticSite(options: PublishOptions): Promise<PublishResult> {
  const files = await collectSiteFiles(options.rootDir, options.includeHidden ?? false);
  const response = await fetch(`${options.endpoint.replace(/\/+$/, "")}/api/sites`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      slug: options.slug,
      files: files.map(({ bytes: _bytes, ...file }) => file)
    })
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { error: text };
  }

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload ? String(payload.error) : text;
    throw new Error(`StaticDrop upload failed (${response.status}): ${message}`);
  }

  return payload as PublishResult;
}

export async function collectSiteFiles(rootDir: string, includeHidden = false): Promise<SiteFile[]> {
  const root = path.resolve(rootDir);
  const rootStats = await stat(root);
  if (!rootStats.isDirectory()) {
    throw new Error(`rootDir must be a directory: ${rootDir}`);
  }

  const files: SiteFile[] = [];
  let totalBytes = 0;

  async function walk(currentDir: string): Promise<void> {
    const entries = await readdir(currentDir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (!includeHidden && entry.name.startsWith(".")) {
        continue;
      }

      const absolute = path.join(currentDir, entry.name);
      const relative = toPosixPath(path.relative(root, absolute));

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) {
          continue;
        }
        await walk(absolute);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const fileStats = await stat(absolute);
      if (fileStats.size > MAX_FILE_BYTES) {
        throw new Error(`${relative} exceeds ${MAX_FILE_BYTES} bytes`);
      }

      totalBytes += fileStats.size;
      if (totalBytes > MAX_UPLOAD_BYTES) {
        throw new Error(`Upload exceeds ${MAX_UPLOAD_BYTES} bytes`);
      }

      const content = await readFile(absolute);
      files.push({
        path: relative,
        contentBase64: content.toString("base64"),
        contentType: guessContentType(relative),
        bytes: fileStats.size
      });

      if (files.length > MAX_FILES) {
        throw new Error(`Too many files. Maximum is ${MAX_FILES}.`);
      }
    }
  }

  await walk(root);

  if (!files.some((file) => file.path === "index.html")) {
    throw new Error("Static sites must include index.html at the root.");
  }

  return files;
}

export function normalizeSlug(slug: string | undefined): string | undefined {
  if (!slug) {
    return undefined;
  }

  const normalized = slug.toLowerCase().trim();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized)) {
    throw new Error("Slug must be 1-63 lowercase letters, numbers, or hyphens, without edge hyphens.");
  }

  return normalized;
}

function guessContentType(filePath: string): string {
  const lower = filePath.toLowerCase();
  const extension = lower.slice(lower.lastIndexOf("."));
  return MIME_BY_EXTENSION[extension] || "application/octet-stream";
}

function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

