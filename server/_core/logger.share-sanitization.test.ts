import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { requestLogger, sanitizeRequestPath } from "./logger";

describe("public-share request logging", () => {
    it("replaces the secret-bearing share path with a fixed label", () => {
        expect(sanitizeRequestPath("/share/sensitive-token-value")).toBe(
            "/share/:token"
        );
        expect(sanitizeRequestPath("/api/trpc/design.resolveShareLink")).toBe(
            "/api/trpc/design.resolveShareLink"
        );
    });

    it("never emits the public share token through requestLogger", () => {
        const token = "sensitive-token-value";
        const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
        let finish: (() => void) | undefined;
        const req = {
            method: "GET",
            path: `/share/${token}`,
            get: () => "TR-13 test",
        } as unknown as Request;
        const res = {
            statusCode: 200,
            on: (event: string, handler: () => void) => {
                if (event === "finish") finish = handler;
            },
        } as unknown as Response;

        requestLogger(req, res, vi.fn() as NextFunction);
        finish?.();

        const serialized = log.mock.calls.flat().join(" ");
        expect(serialized).toContain("/share/:token");
        expect(serialized).not.toContain(token);
        log.mockRestore();
    });
});
