import { z } from "zod";
import { getDb } from "../db";
import { router, protectedProcedure, orgProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { organizations, organizationMembers, organizationInvites, users } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { auditLog } from "../_core/audit";

export const organizationRouter = router({
    createOrg: protectedProcedure
        .input(z.object({
            name: z.string().min(2),
            slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
            domain: z.string().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unconnected" });

            // check slug unique
            const existing = await db.select().from(organizations).where(eq(organizations.slug, input.slug)).limit(1);
            if (existing.length > 0) {
                throw new TRPCError({ code: "CONFLICT", message: "Slug is already taken" });
            }

            // create org
            const [orgResult] = await db.insert(organizations).values({
                name: input.name,
                slug: input.slug,
                domain: input.domain ?? null,
                plan: "free",
            });
            const orgId = Number(orgResult.insertId);

            // add user to org as admin
            await db.insert(organizationMembers).values({
                orgId,
                userId: ctx.user.id,
                role: "admin",
            });

            // assign user to org (make active)
            await db.update(users).set({ orgId }).where(eq(users.id, ctx.user.id));

            return { success: true, orgId };
        }),

    myOrgs: protectedProcedure.query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) return [];
        // Join to find orgs this user belongs to
        const result = await db.select({
            org: organizations,
            role: organizationMembers.role,
        })
            .from(organizationMembers)
            .innerJoin(organizations, eq(organizations.id, organizationMembers.orgId))
            .where(eq(organizationMembers.userId, ctx.user.id));

        return result;
    }),

    inviteMember: orgProcedure
        .input(z.object({
            email: z.string().email(),
            role: z.enum(["admin", "member", "viewer"]),
        }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

            // verify ctx user is admin of this org (technically orgProcedure doesn't guarantee admin, just member)
            const myMembership = await db.select().from(organizationMembers).where(and(eq(organizationMembers.orgId, ctx.orgId), eq(organizationMembers.userId, ctx.user.id))).limit(1);
            if (!myMembership[0] || myMembership[0].role !== "admin") {
                throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can invite members" });
            }

            const token = nanoid(32);
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

            await db.insert(organizationInvites).values({
                orgId: ctx.orgId,
                email: input.email,
                role: input.role,
                token,
                expiresAt,
            });

            // Mock sending email
            console.log(`[Email Mock] Sending invite to ${input.email}: http://localhost:5173/accept-invite?token=${token}`);

            return { success: true, token }; // Returning token just for testing
        }),

    acceptInvite: protectedProcedure
        .input(z.object({ token: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const db = await getDb();
            if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

            const inviteResult = await db.select().from(organizationInvites).where(eq(organizationInvites.token, input.token)).limit(1);
            const invite = inviteResult[0];

            if (!invite) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid invite token" });
            if (invite.expiresAt < new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "Invite expired" });

            // Add to org
            await db.insert(organizationMembers).values({
                orgId: invite.orgId,
                userId: ctx.user.id,
                role: invite.role,
            });

            // Set as active org
            await db.update(users).set({ orgId: invite.orgId }).where(eq(users.id, ctx.user.id));

            // Remove invite
            await db.delete(organizationInvites).where(eq(organizationInvites.id, invite.id));

            return { success: true, orgId: invite.orgId };
        }),
});
