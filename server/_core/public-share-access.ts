import { TRPCError } from "@trpc/server";
import * as db from "../db";
import type { Lookup } from "./resource-access";

type ShareBrief = {
  projectId: number;
  orgId: number | null;
  shareExpiresAt: Date | string | null;
};

type ShareProject = {
  orgId: number | null;
};

type PublicShareOptions<
  Brief extends ShareBrief,
  Project extends ShareProject,
> = {
  lookupBrief?: Lookup<string, Brief>;
  lookupProject?: Lookup<number, Project>;
  now?: () => Date;
};

const PUBLIC_SHARE_NOT_FOUND_MESSAGE = "Share link not found or expired";

function shareNotFound(): never {
  throw new TRPCError({
    code: "NOT_FOUND",
    message: PUBLIC_SHARE_NOT_FOUND_MESSAGE,
  });
}

/**
 * Resolve an unauthenticated public share without mixing it with session-based
 * organization authorization. The brief and project must agree on a non-null
 * organization owner, and expiry is mandatory.
 */
export async function requireActivePublicShare<
  Brief extends ShareBrief = NonNullable<
    Awaited<ReturnType<typeof db.getAiDesignBriefByShareToken>>
  >,
  Project extends ShareProject = NonNullable<
    Awaited<ReturnType<typeof db.getProjectById>>
  >,
>(
  token: string,
  options: PublicShareOptions<Brief, Project> = {}
): Promise<{ brief: Brief; project: Project }> {
  const lookupBrief =
    options.lookupBrief ??
    (db.getAiDesignBriefByShareToken as Lookup<string, Brief>);
  const lookupProject =
    options.lookupProject ?? (db.getProjectById as Lookup<number, Project>);
  const now = options.now ?? (() => new Date());

  const brief = await lookupBrief(token);
  if (!brief) {
    return shareNotFound();
  }

  const project = await lookupProject(brief.projectId);
  const expiresAt = brief.shareExpiresAt
    ? new Date(brief.shareExpiresAt).getTime()
    : Number.NaN;
  const nowTime = now().getTime();

  if (
    !project ||
    brief.orgId === null ||
    project.orgId === null ||
    brief.orgId !== project.orgId ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= nowTime
  ) {
    return shareNotFound();
  }

  return { brief, project };
}
