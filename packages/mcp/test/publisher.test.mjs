import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { collectSiteFiles, normalizeSlug } from "../dist/publisher.js";

test("collectSiteFiles reads a small static site", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "staticdrop-"));
  try {
    await writeFile(path.join(dir, "index.html"), "<h1>Hello</h1>");
    await mkdir(path.join(dir, "assets"));
    await writeFile(path.join(dir, "assets", "app.css"), "body { color: red; }");

    const files = await collectSiteFiles(dir);

    assert.deepEqual(
      files.map((file) => file.path),
      ["assets/app.css", "index.html"]
    );
    assert.equal(files.find((file) => file.path === "index.html").contentType, "text/html; charset=utf-8");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("collectSiteFiles requires root index.html", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "staticdrop-"));
  try {
    await writeFile(path.join(dir, "about.html"), "<h1>About</h1>");
    await assert.rejects(() => collectSiteFiles(dir), /index\.html/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("normalizeSlug accepts clean slugs and rejects unsafe slugs", () => {
  assert.equal(normalizeSlug("My-Site-1"), "my-site-1");
  assert.throws(() => normalizeSlug("-bad"), /Slug/);
  assert.throws(() => normalizeSlug("../bad"), /Slug/);
});

