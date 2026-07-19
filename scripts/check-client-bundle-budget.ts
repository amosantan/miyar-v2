import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

export type ViteManifestChunk = {
  file: string;
  name?: string;
  src?: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
};

export type ViteManifest = Record<string, ViteManifestChunk>;

type RouteBudget = {
  id: string;
  selectors: string[];
  maxGzipBytes: number;
  forbiddenStaticSelectors?: string[];
};

export type BundleBudgetConfig = {
  version: number;
  artifactRoots: {
    default: string;
    vercel: string;
  };
  reportPath: string;
  entry: {
    selector: string;
    maxJavaScriptGzipBytes: number;
    maxCssGzipBytes: number;
  };
  globalChunk: {
    maxRawBytes: number;
    maxGzipBytes: number;
  };
  chunkExceptions?: Array<{
    selector: string;
    maxRawBytes: number;
    maxGzipBytes: number;
    reason: string;
    expiresOn: string;
  }>;
  routes: RouteBudget[];
  requiredDynamicBoundaries: Array<{
    from: string;
    to: string;
  }>;
};

type FileMetric = {
  file: string;
  rawBytes: number;
  gzipBytes: number;
};

type RouteMetric = {
  id: string;
  rawBytes: number;
  gzipBytes: number;
  maxGzipBytes: number;
  files: string[];
};

export type BundleBudgetReport = {
  version: number;
  configSha256: string;
  manifestSha256: string;
  entry: FileMetric & {
    maxJavaScriptGzipBytes: number;
    cssGzipBytes: number;
    maxCssGzipBytes: number;
  };
  largestJavaScriptChunks: FileMetric[];
  chunkExceptions: Array<{
    selector: string;
    resolvedFile: string;
    rawBytes: number;
    gzipBytes: number;
    maxRawBytes: number;
    maxGzipBytes: number;
    reason: string;
    expiresOn: string;
  }>;
  routes: RouteMetric[];
  dynamicBoundaries: Array<{ from: string; to: string; present: boolean }>;
  failures: string[];
  status: "PASS" | "FAIL";
};

export function resolveManifestSelector(
  manifest: ViteManifest,
  selector: string
): string {
  if (manifest[selector]) return selector;

  if (selector.startsWith("name:")) {
    const name = selector.slice("name:".length);
    const matches = Object.entries(manifest)
      .filter(([, chunk]) => chunk.name === name)
      .map(([key]) => key);

    if (matches.length === 1) return matches[0];
    throw new Error(
      `Bundle selector ${selector} matched ${matches.length} manifest records`
    );
  }

  throw new Error(`Bundle selector ${selector} is missing from the Vite manifest`);
}

export function selectClientArtifactRoot(
  config: BundleBudgetConfig,
  environment: { VERCEL?: string }
): string {
  return environment.VERCEL
    ? config.artifactRoots.vercel
    : config.artifactRoots.default;
}

export function collectStaticManifestClosure(
  manifest: ViteManifest,
  selectors: string[]
): Set<string> {
  const visited = new Set<string>();
  const pending = selectors.map((selector) =>
    resolveManifestSelector(manifest, selector)
  );

  while (pending.length > 0) {
    const key = pending.pop();
    if (!key || visited.has(key)) continue;
    const chunk = manifest[key];
    if (!chunk) throw new Error(`Manifest import ${key} is missing`);
    visited.add(key);
    pending.push(...(chunk.imports ?? []));
  }

  return visited;
}

export function collectClosureFiles(
  manifest: ViteManifest,
  closure: Set<string>
): string[] {
  const files = new Set<string>();

  for (const key of closure) {
    const chunk = manifest[key];
    if (/\.(?:js|css)$/.test(chunk.file)) files.add(chunk.file);
    for (const cssFile of chunk.css ?? []) files.add(cssFile);
  }

  return [...files].sort();
}

async function measureFile(artifactRoot: string, file: string): Promise<FileMetric> {
  const contents = await readFile(path.join(artifactRoot, file));
  return {
    file,
    rawBytes: contents.byteLength,
    gzipBytes: gzipSync(contents).byteLength,
  };
}

async function measureFiles(
  artifactRoot: string,
  files: string[]
): Promise<{ rawBytes: number; gzipBytes: number; metrics: FileMetric[] }> {
  const metrics = await Promise.all(
    files.map((file) => measureFile(artifactRoot, file))
  );
  return {
    rawBytes: metrics.reduce((total, metric) => total + metric.rawBytes, 0),
    gzipBytes: metrics.reduce((total, metric) => total + metric.gzipBytes, 0),
    metrics,
  };
}

export async function evaluateBundleBudgets(options: {
  manifest: ViteManifest;
  manifestSource: string;
  configSource?: string;
  config: BundleBudgetConfig;
  artifactRoot: string;
}): Promise<BundleBudgetReport> {
  const { manifest, manifestSource, config, artifactRoot } = options;
  const failures: string[] = [];

  const entryKey = resolveManifestSelector(manifest, config.entry.selector);
  const entryFile = manifest[entryKey].file;
  const entryMetric = await measureFile(artifactRoot, entryFile);
  const entryCssMetric = await measureFiles(
    artifactRoot,
    manifest[entryKey].css ?? []
  );
  if (entryMetric.gzipBytes > config.entry.maxJavaScriptGzipBytes) {
    failures.push(
      `Entry JavaScript is ${entryMetric.gzipBytes} gzip bytes; budget is ${config.entry.maxJavaScriptGzipBytes}`
    );
  }
  if (entryCssMetric.gzipBytes > config.entry.maxCssGzipBytes) {
    failures.push(
      `Entry CSS is ${entryCssMetric.gzipBytes} gzip bytes; budget is ${config.entry.maxCssGzipBytes}`
    );
  }

  const uniqueJavaScriptFiles = [
    ...new Set(
      Object.values(manifest)
        .map((chunk) => chunk.file)
        .filter((file) => file.endsWith(".js"))
    ),
  ];
  const javaScriptMetrics = (
    await measureFiles(artifactRoot, uniqueJavaScriptFiles)
  ).metrics.sort((left, right) => right.rawBytes - left.rawBytes);
  const chunkExceptions = new Map(
    (config.chunkExceptions ?? []).map((exception) => {
      const key = resolveManifestSelector(manifest, exception.selector);
      if (!exception.reason.trim()) {
        failures.push(`Chunk exception ${exception.selector} has no reason`);
      }
      const expiresAt = Date.parse(`${exception.expiresOn}T23:59:59Z`);
      if (!Number.isFinite(expiresAt)) {
        failures.push(
          `Chunk exception ${exception.selector} has invalid expiry ${exception.expiresOn}`
        );
      } else if (expiresAt < Date.now()) {
        failures.push(
          `Chunk exception ${exception.selector} expired on ${exception.expiresOn}`
        );
      }
      return [manifest[key].file, exception] as const;
    })
  );

  for (const metric of javaScriptMetrics) {
    const exception = chunkExceptions.get(metric.file);
    const maxRawBytes = exception?.maxRawBytes ?? config.globalChunk.maxRawBytes;
    const maxGzipBytes =
      exception?.maxGzipBytes ?? config.globalChunk.maxGzipBytes;
    if (metric.rawBytes > maxRawBytes) {
      failures.push(
        `${metric.file} is ${metric.rawBytes} raw bytes; chunk budget is ${maxRawBytes}`
      );
    }
    if (metric.gzipBytes > maxGzipBytes) {
      failures.push(
        `${metric.file} is ${metric.gzipBytes} gzip bytes; chunk budget is ${maxGzipBytes}`
      );
    }
  }

  const appliedChunkExceptions = [...chunkExceptions.entries()].map(
    ([resolvedFile, exception]) => {
      const metric = javaScriptMetrics.find(item => item.file === resolvedFile);
      if (!metric) {
        throw new Error(
          `Chunk exception ${exception.selector} resolved to a missing JavaScript artifact`
        );
      }
      return {
        selector: exception.selector,
        resolvedFile,
        rawBytes: metric.rawBytes,
        gzipBytes: metric.gzipBytes,
        maxRawBytes: exception.maxRawBytes,
        maxGzipBytes: exception.maxGzipBytes,
        reason: exception.reason,
        expiresOn: exception.expiresOn,
      };
    }
  );

  const routes: RouteMetric[] = [];
  for (const route of config.routes) {
    const closure = collectStaticManifestClosure(manifest, route.selectors);
    const files = collectClosureFiles(manifest, closure);
    const totals = await measureFiles(artifactRoot, files);

    routes.push({
      id: route.id,
      rawBytes: totals.rawBytes,
      gzipBytes: totals.gzipBytes,
      maxGzipBytes: route.maxGzipBytes,
      files,
    });

    if (totals.gzipBytes > route.maxGzipBytes) {
      failures.push(
        `${route.id} is ${totals.gzipBytes} gzip bytes; route budget is ${route.maxGzipBytes}`
      );
    }

    for (const forbiddenSelector of route.forbiddenStaticSelectors ?? []) {
      const forbiddenKey = resolveManifestSelector(manifest, forbiddenSelector);
      if (closure.has(forbiddenKey)) {
        failures.push(
          `${route.id} statically reaches forbidden deferred bundle ${forbiddenSelector}`
        );
      }
    }
  }

  const dynamicBoundaries = config.requiredDynamicBoundaries.map((boundary) => {
    const fromKey = resolveManifestSelector(manifest, boundary.from);
    const toKey = resolveManifestSelector(manifest, boundary.to);
    const present = (manifest[fromKey].dynamicImports ?? []).includes(toKey);
    if (!present) {
      failures.push(
        `Required dynamic boundary ${boundary.from} -> ${boundary.to} is missing`
      );
    }
    return { ...boundary, present };
  });

  return {
    version: config.version,
    configSha256: createHash("sha256")
      .update(options.configSource ?? JSON.stringify(config))
      .digest("hex"),
    manifestSha256: createHash("sha256")
      .update(manifestSource)
      .digest("hex"),
    entry: {
      ...entryMetric,
      maxJavaScriptGzipBytes: config.entry.maxJavaScriptGzipBytes,
      cssGzipBytes: entryCssMetric.gzipBytes,
      maxCssGzipBytes: config.entry.maxCssGzipBytes,
    },
    largestJavaScriptChunks: javaScriptMetrics.slice(0, 10),
    chunkExceptions: appliedChunkExceptions,
    routes,
    dynamicBoundaries,
    failures,
    status: failures.length === 0 ? "PASS" : "FAIL",
  };
}

async function main() {
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ".."
  );
  const configPath = path.join(repositoryRoot, "client/bundle-budgets.json");
  const configSource = await readFile(configPath, "utf8");
  const config = JSON.parse(configSource) as BundleBudgetConfig;
  const artifactRoot = path.join(
    repositoryRoot,
    selectClientArtifactRoot(config, process.env)
  );
  const manifestPath = path.join(artifactRoot, ".vite/manifest.json");
  const manifestSource = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestSource) as ViteManifest;
  const report = await evaluateBundleBudgets({
    manifest,
    manifestSource,
    configSource,
    config,
    artifactRoot,
  });

  const reportPath = path.join(repositoryRoot, config.reportPath);
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  for (const route of report.routes) {
    process.stdout.write(
      `${route.id}: ${route.gzipBytes} / ${route.maxGzipBytes} gzip bytes\n`
    );
  }
  process.stdout.write(
    `Client bundle budgets ${report.status}. Report: ${config.reportPath}\n`
  );

  if (report.status === "FAIL") {
    for (const failure of report.failures) process.stderr.write(`- ${failure}\n`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1]
  ? path.resolve(process.argv[1])
  : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(
      `Client bundle budget check failed: ${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
