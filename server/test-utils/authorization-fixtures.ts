import type { User } from "../../drizzle/schema";
import type { TrpcContext } from "../_core/context";

export const AUTH_ORG_A = 101;
export const AUTH_ORG_B = 202;
export const AUTH_ORG_THIRD_PARTY = 303;
export const AUTH_NOW = new Date("2026-07-16T12:00:00.000Z");

function createUser(id: number, orgId: number | null): User {
  return {
    id,
    openId: `authorization-user-${id}`,
    password: null,
    name: `Authorization User ${id}`,
    email: `authorization-${id}@example.invalid`,
    loginMethod: "test",
    role: "user",
    createdAt: AUTH_NOW,
    updatedAt: AUTH_NOW,
    lastSignedIn: AUTH_NOW,
    orgId,
  };
}

function createContext(user: User | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as unknown as TrpcContext["res"],
  };
}

export const authorizationFixtures = {
  contexts: {
    unauthenticated: createContext(null),
    withoutOrganization: createContext(createUser(1, null)),
    orgA: createContext(createUser(2, AUTH_ORG_A)),
    orgB: createContext(createUser(3, AUTH_ORG_B)),
  },
  projects: {
    orgA: { id: 11, orgId: AUTH_ORG_A, name: "Organization A Project" },
    orgB: { id: 22, orgId: AUTH_ORG_B, name: "Organization B Project" },
    thirdParty: {
      id: 33,
      orgId: AUTH_ORG_THIRD_PARTY,
      name: "Third-party Project",
    },
    legacyNull: { id: 44, orgId: null, name: "Legacy Project" },
  },
  resources: {
    orgA: { id: 111, projectId: 11, organizationId: AUTH_ORG_A },
    orgB: { id: 222, projectId: 22, organizationId: AUTH_ORG_B },
    thirdParty: {
      id: 333,
      projectId: 33,
      organizationId: AUTH_ORG_THIRD_PARTY,
    },
    orphan: { id: 444, projectId: 999, organizationId: AUTH_ORG_A },
    legacyNull: { id: 555, projectId: 44, organizationId: null },
    inconsistent: { id: 666, projectId: 11, organizationId: AUTH_ORG_B },
  },
  shares: {
    active: {
      id: 1001,
      projectId: 11,
      orgId: AUTH_ORG_A,
      shareExpiresAt: new Date("2026-07-17T12:00:00.000Z"),
    },
    expired: {
      id: 1002,
      projectId: 11,
      orgId: AUTH_ORG_A,
      shareExpiresAt: new Date("2026-07-15T12:00:00.000Z"),
    },
    exactBoundary: {
      id: 1003,
      projectId: 11,
      orgId: AUTH_ORG_A,
      shareExpiresAt: AUTH_NOW,
    },
    nullExpiry: {
      id: 1004,
      projectId: 11,
      orgId: AUTH_ORG_A,
      shareExpiresAt: null,
    },
    nullOrg: {
      id: 1007,
      projectId: 11,
      orgId: null,
      shareExpiresAt: new Date("2026-07-17T12:00:00.000Z"),
    },
    orphaned: {
      id: 1005,
      projectId: 999,
      orgId: AUTH_ORG_A,
      shareExpiresAt: new Date("2026-07-17T12:00:00.000Z"),
    },
    mismatchedOrg: {
      id: 1006,
      projectId: 11,
      orgId: AUTH_ORG_B,
      shareExpiresAt: new Date("2026-07-17T12:00:00.000Z"),
    },
  },
} as const;
