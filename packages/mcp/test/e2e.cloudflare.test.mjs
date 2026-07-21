import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { publishStaticSite } from "../dist/publisher.js";

const shouldRun = process.env.STATICDROP_E2E === "1";

test("publishes and serves a static site through Cloudflare", { skip: shouldRun ? false : "Set STATICDROP_E2E=1 to run Cloudflare integration test" }, async () => {
  const endpoint = requiredEnv("STATICDROP_ENDPOINT");
  const token = requiredEnv("STATICDROP_TOKEN");
  const rootDir = await mkdtemp(path.join(tmpdir(), "staticdrop-e2e-"));
  const slug = `e2e-${Date.now().toString(36)}`;

  try {
    await mkdir(path.join(rootDir, "assets"));
    await writeFile(
      path.join(rootDir, "index.html"),
      '<!doctype html><html><head><link rel="stylesheet" href="./assets/app.css"></head><body><h1>StaticDrop Cloudflare E2E</h1></body></html>'
    );
    await writeFile(path.join(rootDir, "assets", "app.css"), "body { color: rgb(17, 100, 102); }");

    const health = await fetch(`${endpoint.replace(/\/+$/, "")}/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { ok: true });

    const result = await publishStaticSite({
      endpoint,
      token,
      rootDir,
      slug
    });

    assert.equal(result.slug, slug);
    assert.equal(result.files, 2);
    assert.match(result.url, new RegExp(`/s/${slug}/$`));

    const indexResponse = await fetch(result.url);
    assert.equal(indexResponse.status, 200);
    assert.match(indexResponse.headers.get("content-type") || "", /text\/html/);
    assert.match(await indexResponse.text(), /StaticDrop Cloudflare E2E/);

    const cssResponse = await fetch(`${result.url}assets/app.css`);
    assert.equal(cssResponse.status, 200);
    assert.match(cssResponse.headers.get("content-type") || "", /text\/css/);
    assert.match(await cssResponse.text(), /rgb\(17, 100, 102\)/);

    const unauthorized = await fetch(`${endpoint.replace(/\/+$/, "")}/api/sites`, {
      method: "POST",
      headers: {
        authorization: "Bearer wrong-token",
        "content-type": "application/json"
      },
      body: JSON.stringify({ files: [] })
    });
    assert.equal(unauthorized.status, 401);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

function requiredEnv(name) {
  const value = process.env[name];
  assert.ok(value, `${name} is required when STATICDROP_E2E=1`);
  return value;
}

