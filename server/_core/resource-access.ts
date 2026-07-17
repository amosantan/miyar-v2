import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { requireProjectForOrg } from "./project-access";

export type Lookup<Id, Resource> = (
  id: Id
) => Resource | null | undefined | Promise<Resource | null | undefined>;

export type ProjectRecord = NonNullable<
  Awaited<ReturnType<typeof db.getProjectById>>
>;

type ProjectLookup<Project extends { orgId: number | null }> = (
  id: number
) => Promise<Project | null | undefined>;

type ResourceOptions<Id, Resource, Project extends { orgId: number | null }> = {
  lookupResource: Lookup<Id, Resource>;
  getProjectId: (resource: Resource) => number;
  lookupProject?: ProjectLookup<Project>;
  notFoundMessage?: string;
};

type NestedResourceOptions<
  ChildId,
  Child,
  ParentId,
  Parent,
  Project extends { orgId: number | null },
> = {
  lookupResource: Lookup<ChildId, Child>;
  getParentId: (resource: Child) => ParentId;
  lookupParent: Lookup<ParentId, Parent>;
  getProjectId: (parent: Parent) => number;
  lookupProject?: ProjectLookup<Project>;
  notFoundMessage?: string;
};

type OrgResourceOptions<Id, Resource> = {
  lookupResource: Lookup<Id, Resource>;
  getOrgId: (resource: Resource) => number | null;
  notFoundMessage?: string;
};

type ProjectOrgResourceOptions<
  Id,
  Resource,
  Project extends { orgId: number | null },
> = ResourceOptions<Id, Resource, Project> & {
  getOrgId: (resource: Resource) => number | null;
};

export type AuthorizedProjectResource<Resource, Project> = {
  resource: Resource;
  project: Project;
};

export type AuthorizedNestedProjectResource<Child, Parent, Project> = {
  resource: Child;
  parent: Parent;
  project: Project;
};

const DEFAULT_NOT_FOUND_MESSAGE = "Resource not found";

function notFound(message = DEFAULT_NOT_FOUND_MESSAGE): never {
  throw new TRPCError({ code: "NOT_FOUND", message });
}

async function requireAuthorizedProject<
  Project extends { orgId: number | null },
>(
  projectId: number,
  orgId: number,
  lookupProject: ProjectLookup<Project>,
  notFoundMessage?: string
): Promise<Project> {
  const project = await lookupProject(projectId);
  if (!project || project.orgId !== orgId) {
    return notFound(notFoundMessage);
  }
  return project;
}

/**
 * Authorize a resource whose ownership chain is resource -> project -> organization.
 */
export async function requireProjectResourceForOrg<
  Id,
  Resource,
  Project extends { orgId: number | null } = ProjectRecord,
>(
  resourceId: Id,
  orgId: number,
  options: ResourceOptions<Id, Resource, Project>
): Promise<AuthorizedProjectResource<Resource, Project>> {
  const resource = await options.lookupResource(resourceId);
  if (!resource) {
    return notFound(options.notFoundMessage);
  }

  const project = await requireAuthorizedProject(
    options.getProjectId(resource),
    orgId,
    options.lookupProject ?? (db.getProjectById as ProjectLookup<Project>),
    options.notFoundMessage
  );

  return { resource, project };
}

/**
 * Authorize a nested ownership chain such as join -> board -> project -> organization.
 */
export async function requireNestedProjectResourceForOrg<
  ChildId,
  Child,
  ParentId,
  Parent,
  Project extends { orgId: number | null } = ProjectRecord,
>(
  resourceId: ChildId,
  orgId: number,
  options: NestedResourceOptions<ChildId, Child, ParentId, Parent, Project>
): Promise<AuthorizedNestedProjectResource<Child, Parent, Project>> {
  const resource = await options.lookupResource(resourceId);
  if (!resource) {
    return notFound(options.notFoundMessage);
  }

  const parent = await options.lookupParent(options.getParentId(resource));
  if (!parent) {
    return notFound(options.notFoundMessage);
  }

  const project = await requireAuthorizedProject(
    options.getProjectId(parent),
    orgId,
    options.lookupProject ?? (db.getProjectById as ProjectLookup<Project>),
    options.notFoundMessage
  );

  return { resource, parent, project };
}

/**
 * Authorize a resource that carries its organization owner directly.
 */
export async function requireOrgResourceForOrg<Id, Resource>(
  resourceId: Id,
  orgId: number,
  options: OrgResourceOptions<Id, Resource>
): Promise<Resource> {
  const resource = await options.lookupResource(resourceId);
  if (!resource || options.getOrgId(resource) !== orgId) {
    return notFound(options.notFoundMessage);
  }
  return resource;
}

/**
 * Authorize records that carry both project and organization ownership.
 * Both ownership claims must agree with the caller and the resolved project.
 */
export async function requireProjectOrgResourceForOrg<
  Id,
  Resource,
  Project extends { orgId: number | null } = ProjectRecord,
>(
  resourceId: Id,
  orgId: number,
  options: ProjectOrgResourceOptions<Id, Resource, Project>
): Promise<AuthorizedProjectResource<Resource, Project>> {
  const resource = await options.lookupResource(resourceId);
  if (!resource || options.getOrgId(resource) !== orgId) {
    return notFound(options.notFoundMessage);
  }

  const project = await requireAuthorizedProject(
    options.getProjectId(resource),
    orgId,
    options.lookupProject ?? (db.getProjectById as ProjectLookup<Project>),
    options.notFoundMessage
  );

  return { resource, project };
}

/**
 * Resolve an ordered batch as one authorization decision.
 * This is intentionally not a database transaction; callers must wait for the
 * complete result before starting any downstream side effect.
 */
export async function requireProjectResourceBatchForOrg<Id, Authorized>(
  resourceIds: readonly Id[],
  orgId: number,
  authorize: (resourceId: Id, orgId: number) => Promise<Authorized>
): Promise<Authorized[]> {
  return Promise.all(
    resourceIds.map(resourceId => authorize(resourceId, orgId))
  );
}

type PolymorphicResolver = (id: number, orgId: number) => Promise<unknown>;
type PolymorphicRegistry = Readonly<Record<string, PolymorphicResolver>>;

type PolymorphicAuthorizationResult<Registry extends PolymorphicRegistry> = {
  [Type in keyof Registry]: {
    type: Type;
    value: Awaited<ReturnType<Registry[Type]>>;
  };
}[keyof Registry];

/**
 * Build a closed polymorphic authorizer. The registry is copied and frozen at
 * construction time; production registries belong in core authorization
 * modules and must not be assembled or extended by router call sites.
 */
export function createPolymorphicResourceAuthorizer<
  const Registry extends PolymorphicRegistry,
>(registry: Registry, notFoundMessage = DEFAULT_NOT_FOUND_MESSAGE) {
  const closedRegistry = Object.freeze({ ...registry }) as Registry;

  return async function requirePolymorphicResourceForOrg(
    type: string,
    id: number,
    orgId: number
  ): Promise<PolymorphicAuthorizationResult<Registry>> {
    if (!Object.prototype.hasOwnProperty.call(closedRegistry, type)) {
      return notFound(notFoundMessage);
    }

    const resolver = closedRegistry[type as keyof Registry];
    const value = await resolver(id, orgId);
    return { type, value } as PolymorphicAuthorizationResult<Registry>;
  };
}
