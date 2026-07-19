import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  collectStaticManifestClosure,
  evaluateBundleBudgets,
  resolveManifestSelector,
  selectClientArtifactRoot,
  type BundleBudgetConfig,
  type ViteManifest,
} from "../../scripts/check-client-bundle-budget";

const manifest: ViteManifest = {
  "index.html": {
    file: "assets/entry.js",
    name: "index",
    isEntry: true,
    imports: ["_shared.js"],
    dynamicImports: ["src/pages/Dashboard.tsx"],
    css: ["assets/app.css"],
  },
  "_shared.js": {
    file: "assets/shared.js",
    name: "shared",
    imports: ["index.html"],
  },
  "src/pages/Dashboard.tsx": {
    file: "assets/dashboard.js",
    name: "Dashboard",
    imports: ["index.html"],
    dynamicImports: ["_markdown.js"],
  },
  "_markdown.js": {
    file: "assets/markdown.js",
    name: "MarkdownRenderer",
    imports: ["index.html"],
  },
};

const config: BundleBudgetConfig = {
  version: 1,
  artifactRoots: {
    default: "dist/public",
    vercel: "dist",
  },
  reportPath: "unused",
  entry: {
    selector: "index.html",
    maxJavaScriptGzipBytes: 200,
    maxCssGzipBytes: 200,
  },
  globalChunk: {
    maxRawBytes: 200,
    maxGzipBytes: 200,
  },
  routes: [
    {
      id: "dashboard",
      selectors: ["index.html", "src/pages/Dashboard.tsx"],
      maxGzipBytes: 400,
      forbiddenStaticSelectors: ["name:MarkdownRenderer"],
    },
  ],
  requiredDynamicBoundaries: [
    {
      from: "src/pages/Dashboard.tsx",
      to: "name:MarkdownRenderer",
    },
  ],
};

async function createFixture() {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "miyar-bundle-budget-"));
  await mkdir(path.join(fixtureRoot, "assets"));
  await Promise.all([
    writeFile(path.join(fixtureRoot, "assets/entry.js"), "entry"),
    writeFile(path.join(fixtureRoot, "assets/shared.js"), "shared"),
    writeFile(path.join(fixtureRoot, "assets/dashboard.js"), "dashboard"),
    writeFile(path.join(fixtureRoot, "assets/markdown.js"), "markdown"),
    writeFile(path.join(fixtureRoot, "assets/app.css"), "styles"),
  ]);
  return fixtureRoot;
}

describe("client bundle budget checker", () => {
  it("resolves named chunks and traverses cyclic static imports once", () => {
    expect(resolveManifestSelector(manifest, "name:MarkdownRenderer")).toBe(
      "_markdown.js"
    );
    expect(
      [...collectStaticManifestClosure(manifest, ["src/pages/Dashboard.tsx"])].sort()
    ).toEqual(["_shared.js", "index.html", "src/pages/Dashboard.tsx"]);
  });

  it("selects the client artifact root for local and Vercel builds", () => {
    expect(selectClientArtifactRoot(config, {})).toBe("dist/public");
    expect(selectClientArtifactRoot(config, { VERCEL: "1" })).toBe("dist");
  });

  it("passes bounded routes and proves the optional renderer stays dynamic", async () => {
    const artifactRoot = await createFixture();
    const report = await evaluateBundleBudgets({
      manifest,
      manifestSource: JSON.stringify(manifest),
      config,
      artifactRoot,
    });

    expect(report.status).toBe("PASS");
    expect(report.routes[0].files).toEqual([
      "assets/app.css",
      "assets/dashboard.js",
      "assets/entry.js",
      "assets/shared.js",
    ]);
    expect(report.dynamicBoundaries).toEqual([
      {
        from: "src/pages/Dashboard.tsx",
        to: "name:MarkdownRenderer",
        present: true,
      },
    ]);
    expect(report.configSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(report.chunkExceptions).toEqual([]);
  });

  it("fails oversized entries, chunks, routes, and lost lazy boundaries", async () => {
    const artifactRoot = await createFixture();
    const failingManifest: ViteManifest = {
      ...manifest,
      "src/pages/Dashboard.tsx": {
        ...manifest["src/pages/Dashboard.tsx"],
        imports: ["index.html", "_markdown.js"],
        dynamicImports: [],
      },
    };
    const failingConfig: BundleBudgetConfig = {
      ...config,
      entry: { ...config.entry, maxJavaScriptGzipBytes: 1 },
      globalChunk: { maxRawBytes: 1, maxGzipBytes: 1 },
      routes: [{ ...config.routes[0], maxGzipBytes: 1 }],
    };

    const report = await evaluateBundleBudgets({
      manifest: failingManifest,
      manifestSource: JSON.stringify(failingManifest),
      config: failingConfig,
      artifactRoot,
    });

    expect(report.status).toBe("FAIL");
    expect(report.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Entry JavaScript"),
        expect.stringContaining("chunk budget"),
        expect.stringContaining("route budget"),
        expect.stringContaining("statically reaches forbidden"),
        expect.stringContaining("Required dynamic boundary"),
      ])
    );
  });

  it("fails closed when an emitted artifact is missing", async () => {
    const artifactRoot = await mkdtemp(
      path.join(os.tmpdir(), "miyar-bundle-budget-missing-")
    );

    await expect(
      evaluateBundleBudgets({
        manifest,
        manifestSource: JSON.stringify(manifest),
        config,
        artifactRoot,
      })
    ).rejects.toThrow();
  });

  it("requires named chunk exceptions to remain reviewed and unexpired", async () => {
    const artifactRoot = await createFixture();
    const report = await evaluateBundleBudgets({
      manifest,
      manifestSource: JSON.stringify(manifest),
      config: {
        ...config,
        chunkExceptions: [
          {
            selector: "name:MarkdownRenderer",
            maxRawBytes: 200,
            maxGzipBytes: 200,
            reason: "",
            expiresOn: "2020-01-01",
          },
        ],
      },
      artifactRoot,
    });

    expect(report.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("has no reason"),
        expect.stringContaining("expired on"),
      ])
    );
    expect(report.chunkExceptions).toEqual([
      expect.objectContaining({
        selector: "name:MarkdownRenderer",
        resolvedFile: "assets/markdown.js",
        reason: "",
        expiresOn: "2020-01-01",
      }),
    ]);
  });
});
