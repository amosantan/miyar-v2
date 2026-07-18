import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

export const TR13_SOURCE_ANCHOR_COMMIT =
  "1169fed5e9036bd754cfcb79a7619933515d7f00";

export type Tr13SourceProvenance = {
  baseCommit: string;
  requiredAncestorCommit: string;
  requiredAncestorVerified: true;
  testedHeadCommit: string;
  testedTreeCommit: string;
  workingTreeFingerprint: string;
  workingTreeDirty: boolean;
};

function fail(message: string): never {
  throw new Error(message);
}

export function resolveTr13SourceProvenance(
  root: string,
  anchorCommit = TR13_SOURCE_ANCHOR_COMMIT
): Tr13SourceProvenance {
  const headResult = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  });
  if (headResult.status !== 0) fail("Unable to resolve tested Git HEAD");
  const testedHeadCommit = headResult.stdout.trim();

  const ancestorResult = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", anchorCommit, testedHeadCommit],
    { cwd: root, stdio: "ignore" }
  );
  if (ancestorResult.status !== 0) {
    fail(`TR-13 source must descend from exact anchor ${anchorCommit}`);
  }

  const treeResult = spawnSync("git", ["rev-parse", "HEAD^{tree}"], {
    cwd: root,
    encoding: "utf8",
  });
  if (treeResult.status !== 0) fail("Unable to resolve tested Git tree");
  const testedTreeCommit = treeResult.stdout.trim();

  const diffResult = spawnSync("git", ["diff", "--binary", "HEAD"], {
    cwd: root,
    encoding: null,
    maxBuffer: 50 * 1024 * 1024,
  });
  if (diffResult.status !== 0 || !diffResult.stdout) {
    fail("Unable to fingerprint tracked TR-13 changes");
  }
  const untrackedResult = spawnSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "-z"],
    { cwd: root, encoding: "utf8" }
  );
  if (untrackedResult.status !== 0) {
    fail("Unable to list untracked TR-13 source");
  }
  const untrackedFiles = untrackedResult.stdout
    .split("\0")
    .filter(Boolean)
    .sort();
  const fingerprint = createHash("sha256");
  fingerprint.update("head-commit\0");
  fingerprint.update(testedHeadCommit);
  fingerprint.update("\0head-tree\0");
  fingerprint.update(testedTreeCommit);
  fingerprint.update("\0tracked-diff\0");
  fingerprint.update(diffResult.stdout);
  for (const relativePath of untrackedFiles) {
    fingerprint.update("\0untracked-path\0");
    fingerprint.update(relativePath);
    fingerprint.update("\0untracked-content\0");
    fingerprint.update(readFileSync(path.join(root, relativePath)));
  }
  return {
    baseCommit: anchorCommit,
    requiredAncestorCommit: anchorCommit,
    requiredAncestorVerified: true,
    testedHeadCommit,
    testedTreeCommit,
    workingTreeFingerprint: fingerprint.digest("hex"),
    workingTreeDirty: diffResult.stdout.length > 0 || untrackedFiles.length > 0,
  };
}

export function sameTr13SourceProvenance(
  left: Tr13SourceProvenance,
  right: Tr13SourceProvenance
): boolean {
  return (
    left.requiredAncestorCommit === right.requiredAncestorCommit &&
    left.requiredAncestorVerified === right.requiredAncestorVerified &&
    left.testedHeadCommit === right.testedHeadCommit &&
    left.testedTreeCommit === right.testedTreeCommit &&
    left.workingTreeFingerprint === right.workingTreeFingerprint &&
    left.workingTreeDirty === right.workingTreeDirty
  );
}
