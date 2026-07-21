export interface Env {
  SITES: R2Bucket;
  UPLOAD_TOKEN: string;
  PUBLIC_BASE_URL?: string;
}

type UploadFile = {
  path: string;
  contentBase64: string;
  contentType?: string;
};

type UploadBody = {
  slug?: string;
  files?: UploadFile[];
};

const MAX_FILES = 250;
const MAX_FILE_BYTES = 2_000_000;
const MAX_UPLOAD_BYTES = 25_000_000;

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    if (request.method === "POST" && url.pathname === "/api/sites") {
      return handleUpload(request, env);
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const match = url.pathname.match(/^\/s\/([^/]+)\/?(.*)$/);
      if (match) {
        return serveStatic(env, match[1], match[2] || "index.html", request.method);
      }
    }

    return json({ error: "Not found" }, 404);
  }
};

async function handleUpload(request: Request, env: Env): Promise<Response> {
  const auth = request.headers.get("authorization") || "";
  if (!env.UPLOAD_TOKEN || auth !== `Bearer ${env.UPLOAD_TOKEN}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  const body = await parseJson(request);
  const slug = normalizeSlug(body.slug) || randomSlug();
  const files = body.files || [];

  if (!Array.isArray(files) || files.length === 0) {
    return json({ error: "At least one file is required" }, 400);
  }

  if (files.length > MAX_FILES) {
    return json({ error: `Too many files. Maximum is ${MAX_FILES}.` }, 413);
  }

  let totalBytes = 0;
  const puts: Promise<R2Object | null>[] = [];

  for (const file of files) {
    const path = normalizePath(file.path);
    if (!path) {
      return json({ error: `Invalid file path: ${file.path}` }, 400);
    }

    const bytes = decodeBase64(file.contentBase64);
    if (bytes.byteLength > MAX_FILE_BYTES) {
      return json({ error: `${path} exceeds ${MAX_FILE_BYTES} bytes` }, 413);
    }

    totalBytes += bytes.byteLength;
    if (totalBytes > MAX_UPLOAD_BYTES) {
      return json({ error: `Upload exceeds ${MAX_UPLOAD_BYTES} bytes` }, 413);
    }

    puts.push(
      env.SITES.put(`sites/${slug}/${path}`, bytes, {
        httpMetadata: {
          contentType: file.contentType || guessContentType(path)
        },
        customMetadata: {
          uploadedAt: new Date().toISOString()
        }
      })
    );
  }

  await Promise.all(puts);

  const baseUrl = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  return json(
    {
      slug,
      url: `${baseUrl}/s/${slug}/`,
      files: files.length
    },
    201
  );
}

async function serveStatic(env: Env, slug: string, requestedPath: string, method: string): Promise<Response> {
  const cleanSlug = normalizeSlug(slug);
  const cleanPath = normalizePath(requestedPath.endsWith("/") ? `${requestedPath}index.html` : requestedPath);

  if (!cleanSlug || !cleanPath) {
    return json({ error: "Not found" }, 404);
  }

  const object =
    (await env.SITES.get(`sites/${cleanSlug}/${cleanPath}`)) ||
    (cleanPath.endsWith("/index.html") ? null : await env.SITES.get(`sites/${cleanSlug}/${cleanPath}/index.html`));

  if (!object) {
    return json({ error: "Not found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=300");

  return new Response(method === "HEAD" ? null : object.body, { headers });
}

async function parseJson(request: Request): Promise<UploadBody> {
  try {
    return (await request.json()) as UploadBody;
  } catch {
    return {};
  }
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function normalizeSlug(slug?: string): string | null {
  if (!slug) {
    return null;
  }
  const normalized = slug.toLowerCase().trim();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(normalized) ? normalized : null;
}

function normalizePath(input?: string): string | null {
  if (!input || input.includes("\0")) {
    return null;
  }

  const parts: string[] = [];
  for (const part of input.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") {
      continue;
    }
    if (part === "..") {
      return null;
    }
    parts.push(part);
  }

  const normalized = parts.join("/");
  return normalized && normalized.length <= 512 ? normalized : null;
}

function decodeBase64(input: string): Uint8Array {
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function guessContentType(path: string): string {
  const lower = path.toLowerCase();
  const extension = lower.slice(lower.lastIndexOf("."));
  return MIME_BY_EXTENSION[extension] || "application/octet-stream";
}

function randomSlug(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

