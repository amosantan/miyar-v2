import { describe, expect, it, vi } from "vitest";
import {
  isPublicShareTrpcRequest,
  publicShareHeaders,
  PUBLIC_SHARE_HEADERS,
} from "./public-share-headers";

describe("public share privacy headers", () => {
  it.each([
    "/api/trpc/design.resolveShareLink",
    "/api/trpc/design.resolveShareLink?batch=1&input=bad",
    "/api/trpc/design.listAssets,design.resolveShareLink?batch=1",
    "/api/trpc/design.resolveShareLink,design.listAssets?batch=1",
    "/api/trpc/design.listAssets%2Cdesign.resolveShareLink?batch=1",
    "/api/trpc/design.listAssets,%64esign.resolveShareLink?batch=1",
  ])("matches normal and batched public-share paths: %s", path => {
    expect(isPublicShareTrpcRequest(path)).toBe(true);
  });

  it.each([
    "/api/trpc/design.listAssets",
    "/share/token",
    "/api/trpc/design.resolveShareLinkExtra",
  ])("does not match unrelated paths: %s", path => {
    expect(isPublicShareTrpcRequest(path)).toBe(false);
  });

  it("does not throw on malformed percent escapes", () => {
    expect(isPublicShareTrpcRequest(
      "/api/trpc/design.resolveShareLink%ZZ?batch=1"
    )).toBe(false);
  });

  it("sets headers before the downstream response for malformed or rejected calls", () => {
    const setHeader = vi.fn();
    const next = vi.fn();
    publicShareHeaders(
      { originalUrl: "/api/trpc/design.resolveShareLink?input=malformed" } as any,
      { setHeader } as any,
      next,
    );

    expect(setHeader.mock.calls).toEqual(Object.entries(PUBLIC_SHARE_HEADERS));
    expect(next).toHaveBeenCalledOnce();
  });
});
