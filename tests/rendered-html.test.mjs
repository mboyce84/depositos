import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the DepositOS product experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>DepositOS — The operating system for your rebuild<\/title>/i);
  assert.match(html, /Today’s rebuild/);
  assert.match(html, /Votes for the man you’re becoming/);
  assert.match(html, /Cope differently/);
  assert.match(html, /Sunday reset/);
  assert.match(html, /Daily deposits/);
  assert.match(html, /og:image/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/i);
});

test("ships interactive tracking, local persistence, and responsive navigation", async () => {
  const [page, css, layout, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /localStorage\.setItem\("depositos-deposits"/);
  assert.match(page, /localStorage\.setItem\("depositos-reflections"/);
  assert.match(page, /pressure → escape → regret/);
  assert.match(page, /Alcohol-free days|alcohol-free days/);
  assert.match(page, /AI reflection/);
  assert.match(page, /aria-label="Primary navigation"/);
  for (const namedDeposit of [
    "Fasted walk", "Post-dinner walk", "Protein target", "Calories & macros",
    "Water", "Sleep window", "Strength session", "Alcohol-free",
    "Blood pressure", "Weight check-in", "Daily reflection", "Prayer",
    "Family deposit", "Writing block",
  ]) assert.match(page, new RegExp(namedDeposit.replace("&", "&")));
  assert.match(css, /@media\(max-width:900px\)/);
  assert.match(css, /prefers-reduced-motion:reduce/);
  assert.match(layout, /generateMetadata/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);

  assert.deepEqual(await readdir(new URL("../app/_sites-preview", import.meta.url)), []);
});
