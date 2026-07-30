import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import process from "node:process";

import {
  applyEv02rRejectionApproval,
  buildEv02rDecisionPacket,
  canonicalizeEv02rJson,
  type Ev02rDecisionPacket,
  type Ev02rJsonValue,
} from "../server/engines/material-pricing/unresolved-remediation";

export const EV02R_PRODUCTION_INVENTORY_SHA256 =
  "6c2e244d3fb5f6d8d53e253c3b7a767ed9f8d0cc1a18d4db22c79240a50271ce";
export const EV02R_REJECTION_APPROVAL_REFERENCE =
  "user-approved:2026-07-30:ev02r-24-rejections";

type InventoryArtifact = {
  version: "ev02r-inventory-v1";
  decisionPacketSha256: string;
  decisionPacket: Ev02rDecisionPacket;
};

function valueAfter(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function recordEv02rDecisions(
  artifact: InventoryArtifact,
  recordedAt: string
) {
  if (
    artifact.version !== "ev02r-inventory-v1" ||
    artifact.decisionPacketSha256 !== EV02R_PRODUCTION_INVENTORY_SHA256
  ) {
    throw new Error("EV-02R decision recording rejected an unbound inventory");
  }
  const rebuilt = buildEv02rDecisionPacket(
    artifact.decisionPacket.inventory
  );
  if (
    rebuilt.sha256 !== EV02R_PRODUCTION_INVENTORY_SHA256 ||
    rebuilt.canonicalJson !==
      canonicalizeEv02rJson(artifact.decisionPacket as Ev02rJsonValue)
  ) {
    throw new Error("EV-02R decision recording detected inventory drift");
  }
  const parsedRecordedAt = new Date(recordedAt);
  if (
    Number.isNaN(parsedRecordedAt.getTime()) ||
    parsedRecordedAt.toISOString() !== recordedAt
  ) {
    throw new Error("EV-02R decision recording requires an exact UTC timestamp");
  }

  const decisionPacket = applyEv02rRejectionApproval(
    artifact.decisionPacket.inventory,
    {
      approver: "Amro Saleh",
      approvalReference: EV02R_REJECTION_APPROVAL_REFERENCE,
    }
  );
  if (
    decisionPacket.packet.summary.approved !== 0 ||
    decisionPacket.packet.summary.rejected !== 24 ||
    decisionPacket.packet.summary.needsEvidence !== 19
  ) {
    throw new Error("EV-02R approved decision counts changed");
  }

  return {
    version: "ev02r-human-decision-v1" as const,
    sourceInventorySha256: EV02R_PRODUCTION_INVENTORY_SHA256,
    recordedAt,
    roleAcceptance: {
      dataOwner: "Amro Saleh",
      decisionModelProductOwner: "Amro Saleh",
    },
    approvalReference: EV02R_REJECTION_APPROVAL_REFERENCE,
    decisionPacketSha256: decisionPacket.sha256,
    decisionPacket: decisionPacket.packet,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const inputPath = valueAfter("--inventory");
  const outputPath = valueAfter("--output");
  const recordedAt = valueAfter("--recorded-at");
  if (
    !inputPath ||
    !outputPath ||
    !recordedAt ||
    !isAbsolute(inputPath) ||
    !isAbsolute(outputPath)
  ) {
    throw new Error(
      "EV-02R decision recording requires absolute --inventory and --output paths plus --recorded-at"
    );
  }
  const artifact = JSON.parse(
    readFileSync(inputPath, "utf8")
  ) as InventoryArtifact;
  const recorded = recordEv02rDecisions(artifact, recordedAt);
  writeFileSync(outputPath, `${JSON.stringify(recorded, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    `[ev02r-decisions] PASS rejected=24 needsEvidence=19 approved=0 digest=${recorded.decisionPacketSha256}`
  );
}
