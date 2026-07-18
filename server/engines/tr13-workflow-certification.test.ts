import { describe, expect, it } from "vitest";
import {
  TR13_BRIEF_CONTRACTS,
  TR13_WORKFLOW_FIXTURE,
  TR13_WORKFLOW_FIXTURE_VERSION,
} from "../../tests/fixtures/workflows/tr13-workflow-fixtures";
import {
  assertTr13WorkflowEnvironment,
  TR13_DATABASE_PREFIX,
  tr13ChildEnvironment,
} from "../../scripts/tr13-workflow-certification-contract";
import {
  resolveTr13SourceProvenance,
  sameTr13SourceProvenance,
  TR13_SOURCE_ANCHOR_COMMIT,
} from "../../scripts/tr13-workflow-source-provenance";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const target = `mysql://root:password@127.0.0.1:3306/${TR13_DATABASE_PREFIX}contract`;

describe("TR-13 synthetic workflow fixture contract", () => {
  it("is versioned, synthetic, and covers the full certification stage order", () => {
    expect(TR13_WORKFLOW_FIXTURE.version).toBe(TR13_WORKFLOW_FIXTURE_VERSION);
    expect(TR13_WORKFLOW_FIXTURE.syntheticOnly).toBe(true);
    expect(TR13_WORKFLOW_FIXTURE.expectedStages).toEqual([
      "login",
      "organization",
      "project",
      "evaluation",
      "space_programme",
      "mqi",
      "structured_brief",
      "ai_advisor_brief",
      "stored_report",
      "public_share",
      "share_revocation",
    ]);
  });

  it("keeps deterministic and AI-assisted brief contracts distinct", () => {
    expect(TR13_BRIEF_CONTRACTS.structured.api).toBe("design.generateBrief");
    expect(TR13_BRIEF_CONTRACTS.structured.kind).toBe("structured");
    expect(TR13_BRIEF_CONTRACTS.structured.producer).toBe(
      "deterministic-engine"
    );
    expect(TR13_BRIEF_CONTRACTS.aiAdvisor.api).toBe(
      "designAdvisor.generateDesignBrief"
    );
    expect(TR13_BRIEF_CONTRACTS.aiAdvisor.kind).toBe("ai-advisor-shareable");
    expect(TR13_BRIEF_CONTRACTS.aiAdvisor.producer).toBe(
      "ai-assisted-narrative"
    );
    expect(TR13_BRIEF_CONTRACTS.aiAdvisor.certificationBoundary).toMatch(
      /numerical authority/i
    );
  });
});

describe("TR-13 workflow certification environment", () => {
  it("accepts reconciled descendants and records the exact tested tree", () => {
    const root = mkdtempSync(path.join(tmpdir(), "miyar-tr13-provenance-"));
    const git = (...args: string[]) =>
      execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
    try {
      git("init", "--quiet");
      git("config", "user.name", "MIYAR Synthetic Test");
      git("config", "user.email", "synthetic@example.invalid");
      writeFileSync(path.join(root, "source.txt"), "anchor\n");
      git("add", "source.txt");
      git("commit", "--quiet", "-m", "anchor");
      const anchor = git("rev-parse", "HEAD");
      writeFileSync(path.join(root, "source.txt"), "descendant\n");
      git("commit", "--quiet", "-am", "descendant");

      const provenance = resolveTr13SourceProvenance(root, anchor);
      expect(TR13_SOURCE_ANCHOR_COMMIT).toBe(
        "1169fed5e9036bd754cfcb79a7619933515d7f00"
      );
      expect(provenance.baseCommit).toBe(anchor);
      expect(provenance.requiredAncestorCommit).toBe(anchor);
      expect(provenance.requiredAncestorVerified).toBe(true);
      expect(provenance.testedHeadCommit).toBe(git("rev-parse", "HEAD"));
      expect(provenance.testedTreeCommit).toBe(
        git("rev-parse", "HEAD^{tree}")
      );
      expect(provenance.workingTreeFingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(provenance.workingTreeDirty).toBe(false);

      writeFileSync(path.join(root, "untracked.txt"), "overlay\n");
      const dirty = resolveTr13SourceProvenance(root, anchor);
      expect(dirty.workingTreeDirty).toBe(true);
      expect(sameTr13SourceProvenance(provenance, dirty)).toBe(false);
      expect(() =>
        resolveTr13SourceProvenance(
          root,
          "0000000000000000000000000000000000000000"
        )
      ).toThrow(/must descend from exact anchor/i);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("accepts only an explicit loopback disposable target", () => {
    expect(assertTr13WorkflowEnvironment({ TEST_DATABASE_URL: target })).toBe(
      target
    );
    expect(() =>
      assertTr13WorkflowEnvironment({
        TEST_DATABASE_URL: "mysql://root@db.example.com/miyar_test_tr13_x",
      })
    ).toThrow(/loopback/i);
    expect(() =>
      assertTr13WorkflowEnvironment({
        TEST_DATABASE_URL: "mysql://root@localhost/miyar_test_other",
      })
    ).toThrow(/must begin/i);
  });

  it.each([
    "DATABASE_URL",
    "E2E_BASE_URL",
    "PLAYWRIGHT_BASE_URL",
    "PORT",
    "PLAYWRIGHT_WORKERS",
    "VITEST_MAX_WORKERS",
    "VITEST_MIN_WORKERS",
    "ENABLE_BACKGROUND_JOBS",
    "JWT_SECRET",
  ])("rejects ambient %s", key =>
    expect(() =>
      assertTr13WorkflowEnvironment({
        TEST_DATABASE_URL: target,
        [key]: "value",
      })
    ).toThrow(/Refusing/)
  );

  it("pins child commands to the disposable test profile with workers off", () => {
    const child = tr13ChildEnvironment(target, {
      TEST_DATABASE_URL: target,
      ENABLE_BACKGROUND_JOBS: "true",
      VERCEL: "1",
    });
    expect(child).toMatchObject({
      DATABASE_URL: target,
      DATABASE_SSL_DISABLED: "1",
      NODE_ENV: "test",
      MIYAR_RUNTIME_PROFILE: "test",
      ENABLE_BACKGROUND_JOBS: "false",
      JWT_SECRET: "tr13-synthetic-session-secret-0123456789",
    });
    expect(child.TEST_DATABASE_URL).toBeUndefined();
    expect(child.VERCEL).toBeUndefined();
  });
});
